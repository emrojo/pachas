import { describe, it, expect } from 'vitest';
import { calculateItemizedSplits, LineItemInput } from './itemizedSplitCalculations';

describe('Itemized Split Calculations Engine', () => {
  const members = ['user-1', 'user-2', 'user-3'];

  it('assigns 100% of price to a single selected member', () => {
    const items: LineItemInput[] = [
      { id: '1', description: 'Entrecot', price: 20.0, assignedUserIds: ['user-1'] },
      { id: '2', description: 'Lubina', price: 15.0, assignedUserIds: ['user-2'] },
      { id: '3', description: 'Pasta', price: 10.0, assignedUserIds: ['user-3'] },
    ];

    const res = calculateItemizedSplits(45.0, items, members, 'EUR');
    expect(res.isBalanced).toBe(true);
    expect(res.itemsTotal).toBe(45.0);
    expect(res.difference).toBe(0);

    const owed1 = res.results.find((r) => r.userId === 'user-1')?.amountOwed;
    const owed2 = res.results.find((r) => r.userId === 'user-2')?.amountOwed;
    const owed3 = res.results.find((r) => r.userId === 'user-3')?.amountOwed;

    expect(owed1).toBe(20.0);
    expect(owed2).toBe(15.0);
    expect(owed3).toBe(10.0);
  });

  it('splits shared items equally between multiple assigned members', () => {
    const items: LineItemInput[] = [
      // 10.00 shared between user-1 and user-2 -> 5.00 each
      { id: '1', description: 'Nachos con guacamole', price: 10.0, assignedUserIds: ['user-1', 'user-2'] },
      // 9.00 shared between user-2 and user-3 -> 4.50 each
      { id: '2', description: 'Ración croquetas', price: 9.0, assignedUserIds: ['user-2', 'user-3'] },
    ];

    const res = calculateItemizedSplits(19.0, items, members, 'EUR');
    expect(res.isBalanced).toBe(true);
    expect(res.itemsTotal).toBe(19.0);

    const owed1 = res.results.find((r) => r.userId === 'user-1')?.amountOwed;
    const owed2 = res.results.find((r) => r.userId === 'user-2')?.amountOwed;
    const owed3 = res.results.find((r) => r.userId === 'user-3')?.amountOwed;

    expect(owed1).toBe(5.0);
    expect(owed2).toBe(9.5); // 5.0 + 4.5
    expect(owed3).toBe(4.5);
    expect((owed1 || 0) + (owed2 || 0) + (owed3 || 0)).toBe(19.0);
  });

  it('splits items with 0 assigned members across all group members', () => {
    const items: LineItemInput[] = [
      // 0 assigned users -> split among all 3 members (user-1: 3.34, user-2: 3.33, user-3: 3.33)
      { id: '1', description: 'Botella de vino comunitaria', price: 10.0, assignedUserIds: [] },
      // only user-1
      { id: '2', description: 'Postre de user-1', price: 5.0, assignedUserIds: ['user-1'] },
    ];

    const res = calculateItemizedSplits(15.0, items, members, 'EUR');
    expect(res.isBalanced).toBe(true);
    expect(res.itemsTotal).toBe(15.0);

    const owed1 = res.results.find((r) => r.userId === 'user-1')?.amountOwed || 0;
    const owed2 = res.results.find((r) => r.userId === 'user-2')?.amountOwed || 0;
    const owed3 = res.results.find((r) => r.userId === 'user-3')?.amountOwed || 0;

    expect(owed1 + owed2 + owed3).toBe(15.0);
    expect(owed1).toBe(8.34); // 5.0 + 3.34
    expect(owed2).toBe(3.33);
    expect(owed3).toBe(3.33);
  });

  it('detects unbalance and blocks when sum of items does not match total amount', () => {
    const items: LineItemInput[] = [
      { id: '1', description: 'Item 1', price: 10.0, assignedUserIds: ['user-1'] },
      { id: '2', description: 'Item 2', price: 15.0, assignedUserIds: ['user-2'] },
    ];

    // Total is 30, but items sum to 25 -> difference of +5.00
    const res = calculateItemizedSplits(30.0, items, members, 'EUR');
    expect(res.isBalanced).toBe(false);
    expect(res.itemsTotal).toBe(25.0);
    expect(res.difference).toBe(5.0);
    expect(res.errorMessage).toContain('Descuadre: +5,00');
  });

  it('handles empty items array gracefully', () => {
    const res = calculateItemizedSplits(50.0, [], members, 'EUR');
    expect(res.isBalanced).toBe(false);
    expect(res.itemsTotal).toBe(0);
    expect(res.results).toEqual([]);
  });
});
