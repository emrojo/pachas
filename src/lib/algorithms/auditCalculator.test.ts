import { describe, it, expect } from 'vitest';
import { generateUserAuditTrail } from '@/lib/algorithms/auditCalculator';
import { Expense, GroupMember, Settlement } from '@/types/database';

describe('Audit Calculator Algorithm', () => {
  const members: GroupMember[] = [
    {
      id: 'm-1',
      group_id: 'g-1',
      user_id: 'u-1',
      role: 'admin',
      joined_at: '',
      profile: { id: 'u-1', email: 'alice@test.com', full_name: 'Alice', created_at: '' },
    },
    {
      id: 'm-2',
      group_id: 'g-1',
      user_id: 'u-2',
      role: 'member',
      joined_at: '',
      profile: { id: 'u-2', email: 'bob@test.com', full_name: 'Bob', created_at: '' },
    },
    {
      id: 'm-3',
      group_id: 'g-1',
      user_id: 'u-3',
      role: 'member',
      joined_at: '',
      profile: { id: 'u-3', email: 'carol@test.com', full_name: 'Carol', created_at: '' },
    },
  ];

  const expenses: Expense[] = [
    {
      id: 'e-1',
      group_id: 'g-1',
      created_by: 'u-1',
      title: 'Cena Restaurante',
      amount: 90,
      currency: 'EUR',
      exchange_rate: 1,
      converted_amount: 90,
      category: 'food',
      split_type: 'EQUAL',
      expense_date: '2026-08-10',
      created_at: '2026-08-10T20:00:00Z',
      updated_at: '2026-08-10T20:00:00Z',
      payers: [{ id: 'p-1', expense_id: 'e-1', user_id: 'u-1', amount_paid: 90 }],
      participants: [
        { id: 'pt-1', expense_id: 'e-1', user_id: 'u-1', amount_owed: 30 },
        { id: 'pt-2', expense_id: 'e-1', user_id: 'u-2', amount_owed: 30 },
        { id: 'pt-3', expense_id: 'e-1', user_id: 'u-3', amount_owed: 30 },
      ],
    },
    {
      id: 'e-2',
      group_id: 'g-1',
      created_by: 'u-2',
      title: 'Gasolina Coche',
      amount: 60,
      currency: 'EUR',
      exchange_rate: 1,
      converted_amount: 60,
      category: 'transport',
      split_type: 'EQUAL',
      expense_date: '2026-08-11',
      created_at: '2026-08-11T10:00:00Z',
      updated_at: '2026-08-11T10:00:00Z',
      payers: [{ id: 'p-2', expense_id: 'e-2', user_id: 'u-2', amount_paid: 60 }],
      participants: [
        { id: 'pt-4', expense_id: 'e-2', user_id: 'u-1', amount_owed: 20 },
        { id: 'pt-5', expense_id: 'e-2', user_id: 'u-2', amount_owed: 20 },
        { id: 'pt-6', expense_id: 'e-2', user_id: 'u-3', amount_owed: 20 },
      ],
    },
  ];

  it('generates a full chronological audit trail for Alice (creditor)', () => {
    const steps = generateUserAuditTrail('u-1', 'EUR', members, expenses, []);

    expect(steps.length).toBeGreaterThan(3);
    expect(steps[0].type).toBe('intro');

    // Alice paid 90 EUR in e-1
    const paymentSteps = steps.filter((s) => s.type === 'payment');
    expect(paymentSteps).toHaveLength(1);
    expect(paymentSteps[0].stepAmount).toBe(90);

    // Alice consumed 30 EUR in e-1 and 20 EUR in e-2 -> Total 50 EUR
    const consumptionSteps = steps.filter((s) => s.type === 'consumption');
    expect(consumptionSteps).toHaveLength(2);

    // Each consumption step must have both primary division formula and secondary running addition formula
    expect(consumptionSteps[0].formulaDisplay).toContain('÷');
    expect(consumptionSteps[0].secondaryFormulaDisplay).toContain('+');
    expect(consumptionSteps[0].secondaryCalculatorExpression).toBe('0 + 30');

    expect(consumptionSteps[1].secondaryCalculatorExpression).toBe('30 + 20');

    // Summary step for consumptions
    const consumptionsSummary = steps.find((s) => s.type === 'consumptions_summary');
    expect(consumptionsSummary).toBeDefined();
    expect(consumptionsSummary?.calculatorExpression).toBe('30 + 20');

    // Gross balance step: 90 - 50 = +40 EUR
    const grossStep = steps.find((s) => s.type === 'gross_balance');
    expect(grossStep).toBeDefined();
    expect(grossStep?.runningNet).toBe(40);

    // Final step with FinalSettlementProof
    const finalStep = steps.find((s) => s.type === 'final_net');
    expect(finalStep).toBeDefined();
    expect(finalStep?.runningNet).toBe(40);
    expect(finalStep?.finalSettlementProof).toBeDefined();
    expect(finalStep?.finalSettlementProof?.isCreditor).toBe(true);
    expect(finalStep?.finalSettlementProof?.totalSettlementAmount).toBe(40);
    expect(finalStep?.finalSettlementProof?.zeroingCalcExpr).toBe('40 - 40');
    expect(finalStep?.explanation).toContain('0,00');
  });

  it('tracks direct settlements accurately in Bob audit trail', () => {
    // Bob owes 20 - 60 = -40 initially (paid 60, consumed 50 -> net +10)
    // Let's add settlement: Bob pays Alice 10 EUR
    const settlements: Settlement[] = [
      {
        id: 's-1',
        group_id: 'g-1',
        from_user_id: 'u-2',
        to_user_id: 'u-1',
        amount: 10,
        currency: 'EUR',
        payment_method: 'BIZUM',
        settled_at: '2026-08-12T12:00:00Z',
        created_at: '2026-08-12T12:00:00Z',
      },
    ];

    const steps = generateUserAuditTrail('u-2', 'EUR', members, expenses, settlements);
    const settlementSteps = steps.filter((s) => s.type === 'settlement');
    expect(settlementSteps).toHaveLength(1);
    expect(settlementSteps[0].stepAmount).toBe(10);
  });

  it('handles foreign currency conversions and generates conversionInfo and rich descriptions', () => {
    const foreignExpenses: Expense[] = [
      {
        id: 'e-foreign-1',
        group_id: 'g-1',
        created_by: 'u-1',
        title: 'Hotel Tokyo',
        amount: 15000,
        currency: 'JPY',
        exchange_rate: 0.0062,
        converted_amount: 93,
        category: 'accommodation',
        split_type: 'EQUAL',
        expense_date: '2026-08-15',
        created_at: '2026-08-15T10:00:00Z',
        updated_at: '2026-08-15T10:00:00Z',
        payers: [{ id: 'p-f-1', expense_id: 'e-foreign-1', user_id: 'u-1', amount_paid: 15000 }],
        participants: [
          { id: 'pt-f-1', expense_id: 'e-foreign-1', user_id: 'u-1', amount_owed: 31 },
          { id: 'pt-f-2', expense_id: 'e-foreign-1', user_id: 'u-2', amount_owed: 31 },
          { id: 'pt-f-3', expense_id: 'e-foreign-1', user_id: 'u-3', amount_owed: 31 },
        ],
      },
    ];

    const steps = generateUserAuditTrail('u-1', 'EUR', members, foreignExpenses, []);
    const paymentStep = steps.find((s) => s.type === 'payment');
    expect(paymentStep).toBeDefined();
    expect(paymentStep?.conversionInfo).toBeDefined();
    expect(paymentStep?.conversionInfo?.isForeignCurrency).toBe(true);
    expect(paymentStep?.conversionInfo?.originalCurrency).toBe('JPY');
    expect(paymentStep?.conversionInfo?.originalAmount).toBe(15000);
    expect(paymentStep?.conversionInfo?.conversionCalcExpr).toBe('15000 * 0.0062');
    expect(paymentStep?.explanation).toContain('15.000');

    const consumptionStep = steps.find((s) => s.type === 'consumption');
    expect(consumptionStep).toBeDefined();
    expect(consumptionStep?.conversionInfo).toBeDefined();
    expect(consumptionStep?.explanation).toContain('15.000');
    expect(consumptionStep?.explanation).toContain('31');
  });

  it('correctly calculates and displays SHARES split details, formula and explanation', () => {
    const sharesExpense: Expense = {
      id: 'e-shares-1',
      group_id: 'g-1',
      created_by: 'u-1',
      title: 'Barbacoa',
      amount: 90,
      currency: 'EUR',
      exchange_rate: 1,
      converted_amount: 90,
      category: 'food',
      split_type: 'SHARES',
      expense_date: '2026-08-20',
      created_at: '2026-08-20T14:00:00Z',
      updated_at: '2026-08-20T14:00:00Z',
      payers: [{ id: 'p-s-1', expense_id: 'e-shares-1', user_id: 'u-1', amount_paid: 90 }],
      participants: [
        { id: 'pt-s-1', expense_id: 'e-shares-1', user_id: 'u-1', amount_owed: 60, shares: 2 },
        { id: 'pt-s-2', expense_id: 'e-shares-1', user_id: 'u-2', amount_owed: 30, shares: 1 },
      ],
    };

    const steps = generateUserAuditTrail('u-1', 'EUR', members, [sharesExpense], []);
    const consumptionStep = steps.find((s) => s.type === 'consumption');

    expect(consumptionStep).toBeDefined();
    expect(consumptionStep?.splitDetails).toBeDefined();
    expect(consumptionStep?.splitDetails?.splitMode).toBe('SHARES');
    expect(consumptionStep?.splitDetails?.userShares).toBe(2);
    expect(consumptionStep?.splitDetails?.totalShares).toBe(3);
    expect(consumptionStep?.splitDetails?.userPercentage).toBeCloseTo(66.67, 1);

    // Virtual calculator expression must be executable math with parentheses: (90 / 3) * 2
    expect(consumptionStep?.calculatorExpression).toBe('(90 / 3) * 2');

    // Formula display must show the shares breakdown
    expect(consumptionStep?.formulaDisplay).toContain('÷ 3 partes');
    expect(consumptionStep?.formulaDisplay).toContain('× 2 partes');
    expect(consumptionStep?.formulaDisplay).toContain('60,00');

    // Explanation must describe unit share cost and multiplication
    expect(consumptionStep?.explanation).toContain('repartido por raciones');
    expect(consumptionStep?.explanation).toContain('3 partes en total');
    expect(consumptionStep?.explanation).toContain('30,00');
    expect(consumptionStep?.explanation).toContain('2 raciones');
  });

  it('correctly calculates and displays PERCENTAGE split details, formula and explanation', () => {
    const percentageExpense: Expense = {
      id: 'e-pct-1',
      group_id: 'g-1',
      created_by: 'u-1',
      title: 'Alojamiento Villa',
      amount: 200,
      currency: 'EUR',
      exchange_rate: 1,
      converted_amount: 200,
      category: 'accommodation',
      split_type: 'PERCENTAGE',
      expense_date: '2026-08-22',
      created_at: '2026-08-22T12:00:00Z',
      updated_at: '2026-08-22T12:00:00Z',
      payers: [{ id: 'p-p-1', expense_id: 'e-pct-1', user_id: 'u-1', amount_paid: 200 }],
      participants: [
        { id: 'pt-p-1', expense_id: 'e-pct-1', user_id: 'u-1', amount_owed: 140, percentage: 70 },
        { id: 'pt-p-2', expense_id: 'e-pct-1', user_id: 'u-2', amount_owed: 60, percentage: 30 },
      ],
    };

    const steps = generateUserAuditTrail('u-1', 'EUR', members, [percentageExpense], []);
    const consumptionStep = steps.find((s) => s.type === 'consumption');

    expect(consumptionStep).toBeDefined();
    expect(consumptionStep?.splitDetails).toBeDefined();
    expect(consumptionStep?.splitDetails?.splitMode).toBe('PERCENTAGE');
    expect(consumptionStep?.splitDetails?.userPercentage).toBe(70);

    // Virtual calculator expression must be executable math: (200 * 70) / 100
    expect(consumptionStep?.calculatorExpression).toBe('(200 * 70) / 100');

    // Formula display must show the percentage breakdown
    expect(consumptionStep?.formulaDisplay).toContain('200,00');
    expect(consumptionStep?.formulaDisplay).toContain('70%');
    expect(consumptionStep?.formulaDisplay).toContain('÷ 100');
    expect(consumptionStep?.formulaDisplay).toContain('140,00');

    // Explanation must describe total amount and percentage multiplication
    expect(consumptionStep?.explanation).toContain('repartido por porcentaje');
    expect(consumptionStep?.explanation).toContain('70% para ti');
    expect(consumptionStep?.explanation).toContain('140,00');
  });
});
