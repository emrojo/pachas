import { describe, it, expect } from 'vitest';
import { calculateBalances, simplifyDebts } from './simplifyDebts';
import { GroupMember, Expense, Settlement, Profile } from '@/types/database';

describe('simplifyDebts & calculateBalances Algorithms', () => {
  const mockProfiles: Record<string, Profile> = {
    u1: { id: 'u1', email: 'a@test.com', full_name: 'Ana', created_at: '' },
    u2: { id: 'u2', email: 'b@test.com', full_name: 'Bernat', created_at: '' },
    u3: { id: 'u3', email: 'c@test.com', full_name: 'Carla', created_at: '' },
    u4: { id: 'u4', email: 'd@test.com', full_name: 'David', created_at: '' },
  };

  const members: GroupMember[] = [
    { id: 'gm1', group_id: 'g1', user_id: 'u1', role: 'admin', joined_at: '', profile: mockProfiles.u1 },
    { id: 'gm2', group_id: 'g1', user_id: 'u2', role: 'member', joined_at: '', profile: mockProfiles.u2 },
    { id: 'gm3', group_id: 'g1', user_id: 'u3', role: 'member', joined_at: '', profile: mockProfiles.u3 },
    { id: 'gm4', group_id: 'g1', user_id: 'u4', role: 'member', joined_at: '', profile: mockProfiles.u4 },
  ];

  it('calculates equal split expense correctly among all members', () => {
    const expenses: Expense[] = [
      {
        id: 'e1',
        group_id: 'g1',
        created_by: 'u1',
        title: 'Cena bienvenida',
        amount: 100,
        currency: 'EUR',
        exchange_rate: 1,
        converted_amount: 100,
        category: 'food',
        expense_date: '2026-08-10',
        split_type: 'EQUAL',
        created_at: '',
        updated_at: '',
        payers: [{ id: 'p1', expense_id: 'e1', user_id: 'u1', amount_paid: 100 }],
        participants: [
          { id: 'pt1', expense_id: 'e1', user_id: 'u1', amount_owed: 25 },
          { id: 'pt2', expense_id: 'e1', user_id: 'u2', amount_owed: 25 },
          { id: 'pt3', expense_id: 'e1', user_id: 'u3', amount_owed: 25 },
          { id: 'pt4', expense_id: 'e1', user_id: 'u4', amount_owed: 25 },
        ],
      },
    ];

    const balances = calculateBalances(members, expenses);
    const ana = balances.find((b) => b.user_id === 'u1')!;
    const bernat = balances.find((b) => b.user_id === 'u2')!;

    expect(ana.total_paid).toBe(100);
    expect(ana.total_owed).toBe(25);
    expect(ana.net_balance).toBe(75);

    expect(bernat.total_paid).toBe(0);
    expect(bernat.total_owed).toBe(25);
    expect(bernat.net_balance).toBe(-25);

    const debts = simplifyDebts(balances);
    expect(debts.length).toBe(3); // Bernat, Carla, David each pay 25 to Ana
    expect(debts.every((d) => d.to_user_id === 'u1' && d.amount === 25)).toBe(true);
  });

  it('minimizes cyclic circular debts (A owes B, B owes C, C owes A)', () => {
    // Balances where A has net +10, B has -30, C has +20
    const balances = [
      { user_id: 'u1', profile: mockProfiles.u1, total_paid: 50, total_owed: 40, net_balance: 10 },
      { user_id: 'u2', profile: mockProfiles.u2, total_paid: 10, total_owed: 40, net_balance: -30 },
      { user_id: 'u3', profile: mockProfiles.u3, total_paid: 60, total_owed: 40, net_balance: 20 },
      { user_id: 'u4', profile: mockProfiles.u4, total_paid: 40, total_owed: 40, net_balance: 0 },
    ];

    const debts = simplifyDebts(balances);

    // B should pay 20 to C and 10 to A in only 2 transactions instead of 4
    expect(debts.length).toBe(2);
    const toC = debts.find((d) => d.to_user_id === 'u3');
    const toA = debts.find((d) => d.to_user_id === 'u1');

    expect(toC?.from_user_id).toBe('u2');
    expect(toC?.amount).toBe(20);

    expect(toA?.from_user_id).toBe('u2');
    expect(toA?.amount).toBe(10);
  });

  it('takes recorded settlements into account when calculating balances', () => {
    const expenses: Expense[] = [
      {
        id: 'e1',
        group_id: 'g1',
        created_by: 'u1',
        title: 'Hotel',
        amount: 200,
        currency: 'EUR',
        exchange_rate: 1,
        converted_amount: 200,
        category: 'accommodation',
        expense_date: '2026-08-10',
        split_type: 'EQUAL',
        created_at: '',
        updated_at: '',
        payers: [{ id: 'p1', expense_id: 'e1', user_id: 'u1', amount_paid: 200 }],
        participants: [
          { id: 'pt1', expense_id: 'e1', user_id: 'u1', amount_owed: 100 },
          { id: 'pt2', expense_id: 'e1', user_id: 'u2', amount_owed: 100 },
        ],
      },
    ];

    // Bernat already sent 100 to Ana via Bizum
    const settlements: Settlement[] = [
      {
        id: 's1',
        group_id: 'g1',
        from_user_id: 'u2',
        to_user_id: 'u1',
        amount: 100,
        currency: 'EUR',
        payment_method: 'BIZUM',
        settled_at: '2026-08-11T10:00:00Z',
        created_at: '2026-08-11T10:00:00Z',
      },
    ];

    const balances = calculateBalances(members, expenses, settlements);
    const ana = balances.find((b) => b.user_id === 'u1')!;
    const bernat = balances.find((b) => b.user_id === 'u2')!;

    expect(ana.net_balance).toBe(0);
    expect(bernat.net_balance).toBe(0);

    const debts = simplifyDebts(balances);
    expect(debts.length).toBe(0); // All debts settled!
  });

  it('correctly calculates balances for foreign currency expenses (e.g. GBP in EUR group)', () => {
    // Expense in GBP: 85 GBP = 100 EUR (rate 0.85). Single member Ana pays 85 GBP and owes 100 EUR.
    const foreignExpense: Expense = {
      id: 'e_gbp',
      group_id: 'g1',
      created_by: 'u1',
      title: 'London Bus',
      amount: 85,
      currency: 'GBP',
      exchange_rate: 0.85,
      converted_amount: 100,
      category: 'transport',
      expense_date: '2026-08-12',
      split_type: 'EQUAL',
      created_at: '',
      updated_at: '',
      payers: [{ id: 'p1', expense_id: 'e_gbp', user_id: 'u1', amount_paid: 85 }],
      participants: [
        { id: 'pt1', expense_id: 'e_gbp', user_id: 'u1', amount_owed: 100 },
      ],
    };

    const singleMemberGroup = [members[0]];
    const balances = calculateBalances(singleMemberGroup, [foreignExpense]);
    const ana = balances.find((b) => b.user_id === 'u1')!;

    // Converted paid is 100 EUR, owed is 100 EUR -> net balance 0
    expect(ana.total_paid).toBe(100);
    expect(ana.total_owed).toBe(100);
    expect(ana.net_balance).toBe(0);

    const debts = simplifyDebts(balances);
    expect(debts.length).toBe(0);
  });
});
