import { describe, it, expect } from 'vitest';
import { detectExpenseChanges } from './expenseChangeDetector';
import { Expense } from '@/types/database';
import { CreateExpenseInput } from '@/context/PachasContext';

describe('Expense Change Detector', () => {
  const members = [
    { user_id: 'u1', profile: { id: 'u1', email: 'ana@example.com', full_name: 'Ana García', created_at: '' } },
    { user_id: 'u2', profile: { id: 'u2', email: 'carlos@example.com', full_name: 'Carlos Ruiz', created_at: '' } },
    { user_id: 'u3', profile: { id: 'u3', email: 'david@example.com', full_name: 'David López', created_at: '' } },
  ];

  const baseExpense: Expense = {
    id: 'exp-1',
    group_id: 'grp-1',
    created_by: 'u1',
    title: 'Cena italiana',
    amount: 50.0,
    currency: 'EUR',
    category: 'food',
    expense_date: '2026-09-12T20:30:00',
    split_type: 'EQUAL',
    created_at: '2026-09-12T20:30:00',
    updated_at: '2026-09-12T20:30:00',
    payers: [{ id: 'p1', expense_id: 'exp-1', user_id: 'u1', amount_paid: 50.0 }],
    participants: [
      { id: 'part1', expense_id: 'exp-1', user_id: 'u1', amount_owed: 25.0 },
      { id: 'part2', expense_id: 'exp-1', user_id: 'u2', amount_owed: 25.0 },
    ],
    notes: 'Pizzas y bebidas',
  };

  const baseInput: CreateExpenseInput = {
    groupId: 'grp-1',
    title: 'Cena italiana',
    amount: 50.0,
    currency: 'EUR',
    category: 'food',
    expenseDate: '2026-09-12T20:30:00',
    splitType: 'EQUAL',
    payers: [{ userId: 'u1', amountPaid: 50.0 }],
    selectedParticipantIds: ['u1', 'u2'],
    notes: 'Pizzas y bebidas',
  };

  it('detects no changes when input matches original expense', () => {
    const diffs = detectExpenseChanges(baseExpense, baseInput, { members, currency: 'EUR' });
    expect(diffs).toEqual([]);
  });

  it('detects changes in title and amount', () => {
    const updated: CreateExpenseInput = {
      ...baseInput,
      title: 'Cena italiana y postres',
      amount: 60.0,
    };

    const diffs = detectExpenseChanges(baseExpense, updated, { members, currency: 'EUR' });
    expect(diffs.length).toBe(2);

    const titleDiff = diffs.find((d) => d.fieldKey === 'title');
    expect(titleDiff).toBeDefined();
    expect(titleDiff?.oldValue).toBe('Cena italiana');
    expect(titleDiff?.newValue).toBe('Cena italiana y postres');

    const amountDiff = diffs.find((d) => d.fieldKey === 'amount');
    expect(amountDiff).toBeDefined();
    expect(amountDiff?.oldValue).toContain('50,00');
    expect(amountDiff?.newValue).toContain('60,00');
  });

  it('detects changes in payer and participants', () => {
    const updated: CreateExpenseInput = {
      ...baseInput,
      payers: [{ userId: 'u2', amountPaid: 50.0 }],
      selectedParticipantIds: ['u1', 'u2', 'u3'],
    };

    const diffs = detectExpenseChanges(baseExpense, updated, { members, currency: 'EUR' });
    expect(diffs.length).toBe(2);

    const payerDiff = diffs.find((d) => d.fieldKey === 'payers');
    expect(payerDiff).toBeDefined();
    expect(payerDiff?.oldValue).toContain('Ana García');
    expect(payerDiff?.newValue).toContain('Carlos Ruiz');

    const partDiff = diffs.find((d) => d.fieldKey === 'participants');
    expect(partDiff).toBeDefined();
    expect(partDiff?.oldValue).toContain('2 amigos');
    expect(partDiff?.newValue).toContain('Todos (3 amigos)');
  });

  it('detects changes in category and split type', () => {
    const updated: CreateExpenseInput = {
      ...baseInput,
      category: 'activities',
      splitType: 'ITEMIZED',
      items: [
        { id: 'it1', description: 'Museo', price: 50.0, assigned_user_ids: ['u1'] },
      ],
    };

    const diffs = detectExpenseChanges(baseExpense, updated, { members, currency: 'EUR' });
    const catDiff = diffs.find((d) => d.fieldKey === 'category');
    expect(catDiff).toBeDefined();
    expect(catDiff?.oldValue).toContain('Comida');
    expect(catDiff?.newValue).toContain('Actividades');

    const splitDiff = diffs.find((d) => d.fieldKey === 'split_type');
    expect(splitDiff).toBeDefined();
    expect(splitDiff?.newValue).toContain('Por productos');
  });

  it('detects notes and receipt changes', () => {
    const updated: CreateExpenseInput = {
      ...baseInput,
      notes: 'Nueva nota añadida',
      receiptUrl: 'https://example.com/receipt.jpg',
    };

    const diffs = detectExpenseChanges(baseExpense, updated, { members, currency: 'EUR' });
    const noteDiff = diffs.find((d) => d.fieldKey === 'notes');
    expect(noteDiff?.oldValue).toBe('Pizzas y bebidas');
    expect(noteDiff?.newValue).toBe('Nueva nota añadida');

    const receiptDiff = diffs.find((d) => d.fieldKey === 'receipt');
    expect(receiptDiff?.oldValue).toBe('Sin ticket');
    expect(receiptDiff?.newValue).toBe('Con ticket adjunto');
  });
});