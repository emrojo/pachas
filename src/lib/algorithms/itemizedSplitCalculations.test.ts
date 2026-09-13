import { describe, it, expect } from 'vitest';
import { calculateItemizedSplits, LineItemInput } from './itemizedSplitCalculations';

describe('Itemized Split Calculations Engine', () => {
  const members = ['user-1', 'user-2', 'user-3'];

  it('assigns 100% of price to a single selected member when quantity is 1', () => {
    const items: LineItemInput[] = [
      { id: '1', description: 'Entrecot', price: 20.0, quantity: 1, assignedUserIds: ['user-1'] },
      { id: '2', description: 'Lubina', price: 15.0, quantity: 1, assignedUserIds: ['user-2'] },
      { id: '3', description: 'Pasta', price: 10.0, quantity: 1, assignedUserIds: ['user-3'] },
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

  it('proportionally splits an item when quantity > 1 (e.g. user-1 took 2, user-2 took 1)', () => {
    const items: LineItemInput[] = [
      {
        id: '1',
        description: 'Cervezas Artesanales',
        price: 9.0, // 3 cervezas a 3€ cada una = 9.00€
        quantity: 3,
        assignedUserIds: ['user-1', 'user-2'],
        assignedShares: {
          'user-1': 2, // 2 cervezas -> 6.00€
          'user-2': 1, // 1 cerveza   -> 3.00€
        },
      },
    ];

    const res = calculateItemizedSplits(9.0, items, members, 'EUR');
    expect(res.isBalanced).toBe(true);
    expect(res.itemsTotal).toBe(9.0);

    const owed1 = res.results.find((r) => r.userId === 'user-1')?.amountOwed;
    const owed2 = res.results.find((r) => r.userId === 'user-2')?.amountOwed;

    expect(owed1).toBe(6.0);
    expect(owed2).toBe(3.0);
  });

  it('blocks and marks unbalanced if an item with quantity > 1 is only partially assigned', () => {
    const items: LineItemInput[] = [
      {
        id: '1',
        description: 'Pizzas',
        price: 30.0,
        quantity: 3,
        assignedUserIds: ['user-1'],
        assignedShares: {
          'user-1': 1, // Only 1 of 3 pizzas assigned! 2 remain unassigned
        },
      },
    ];

    const res = calculateItemizedSplits(30.0, items, members, 'EUR');
    expect(res.isBalanced).toBe(false);
    expect(res.hasUnassignedItems).toBe(true);
    expect(res.errorMessage).toContain('Debes distribuir todas las unidades');
    expect(res.errorMessage).toContain('1 de 3 unidades asignadas');
  });

  it('calculates splits including taxes (price + tax_amount)', () => {
    const items: LineItemInput[] = [
      {
        id: '1',
        description: 'Cena con IVA 10%',
        price: 20.0, // Base
        tax_rate: 10,
        tax_amount: 2.0, // IVA
        quantity: 2,
        assignedUserIds: ['user-1', 'user-2'],
        assignedShares: {
          'user-1': 1, // Pays 11.00 (10.0 base + 1.0 tax)
          'user-2': 1, // Pays 11.00 (10.0 base + 1.0 tax)
        },
      },
    ];

    // Total invoice is Base 20.0 + Tax 2.0 = 22.0
    const res = calculateItemizedSplits(22.0, items, members, 'EUR');
    expect(res.isBalanced).toBe(true);
    expect(res.itemsNetTotal).toBe(20.0);
    expect(res.itemsTaxTotal).toBe(2.0);
    expect(res.itemsTotal).toBe(22.0);

    const u1 = res.results.find((r) => r.userId === 'user-1');
    const u2 = res.results.find((r) => r.userId === 'user-2');

    expect(u1?.amountOwed).toBe(11.0);
    expect(u1?.netOwed).toBe(10.0);
    expect(u1?.taxOwed).toBe(1.0);

    expect(u2?.amountOwed).toBe(11.0);
    expect(u2?.netOwed).toBe(10.0);
    expect(u2?.taxOwed).toBe(1.0);
  });

  it('detects unbalance when sum of items does not match total amount', () => {
    const items: LineItemInput[] = [
      { id: '1', description: 'Item 1', price: 10.0, quantity: 1, assignedUserIds: ['user-1'] },
      { id: '2', description: 'Item 2', price: 15.0, quantity: 1, assignedUserIds: ['user-2'] },
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
