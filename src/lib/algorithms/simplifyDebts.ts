import {
  GroupMember,
  Expense,
  Settlement,
  MemberBalance,
  SimplifiedDebt,
  Profile,
} from '@/types/database';

/**
 * Calculates net balances for all group members based on expenses, payers,
 * participants, and already recorded settlements.
 * All computations are standardized in the group's base currency.
 */
export function calculateBalances(
  members: GroupMember[],
  expenses: Expense[],
  settlements: Settlement[] = []
): MemberBalance[] {
  const balanceMap = new Map<
    string,
    {
      profile: Profile;
      paid: number;
      owed: number;
      settledSent: number;
      settledReceived: number;
    }
  >();

  // Initialize all members
  for (const m of members) {
    balanceMap.set(m.user_id, {
      profile: m.profile || {
        id: m.user_id,
        email: '',
        full_name: `Usuario ${m.user_id.substring(0, 4)}`,
        created_at: '',
      },
      paid: 0,
      owed: 0,
      settledSent: 0,
      settledReceived: 0,
    });
  }

  // 1. Process Expenses
  for (const expense of expenses) {
    const expenseBaseAmount = expense.converted_amount || expense.amount;
    const expenseOrigAmount = expense.amount > 0 ? expense.amount : expenseBaseAmount || 1;

    // Process Participants (Who owes - stored in base currency)
    // If a participant has already reimbursed the lender (has_paid = true),
    // they no longer owe this debt in the final balance ("para que no cuente").
    // Correspondingly, the payer(s) who received this reimbursement should not
    // have this portion counted as an outstanding credit to be settled, keeping sum of net balances = 0.
    let reimbursedBase = 0;
    if (expense.participants && expense.participants.length > 0) {
      for (const participant of expense.participants) {
        const owed = Number(participant.amount_owed) || 0;
        if (participant.has_paid) {
          reimbursedBase += owed;
        } else {
          const entry = balanceMap.get(participant.user_id);
          if (entry) {
            entry.owed += owed;
          }
        }
      }
    }

    // Process Payers (Who paid) - convert to base currency minus reimbursed portion
    if (expense.payers && expense.payers.length > 0) {
      for (const payer of expense.payers) {
        const entry = balanceMap.get(payer.user_id);
        if (entry) {
          const payerFraction = Number(payer.amount_paid) / expenseOrigAmount;
          const payerInBase = payerFraction * expenseBaseAmount;
          const payerReimbursed = payerFraction * reimbursedBase;
          entry.paid += Math.max(0, payerInBase - payerReimbursed);
        }
      }
    } else {
      // Single payer fallback (created_by)
      const entry = balanceMap.get(expense.created_by);
      if (entry) {
        entry.paid += Math.max(0, Number(expenseBaseAmount) - reimbursedBase);
      }
    }
  }

  // 2. Process Settlements (Who paid whom directly)
  for (const settlement of settlements) {
    const fromEntry = balanceMap.get(settlement.from_user_id);
    const toEntry = balanceMap.get(settlement.to_user_id);

    if (fromEntry) {
      fromEntry.settledSent += Number(settlement.amount);
    }
    if (toEntry) {
      toEntry.settledReceived += Number(settlement.amount);
    }
  }

  // 3. Construct MemberBalance array
  const result: MemberBalance[] = [];

  for (const [userId, val] of balanceMap.entries()) {
    const totalPaid = Math.round((val.paid + val.settledSent) * 100) / 100;
    const totalOwed = Math.round((val.owed + val.settledReceived) * 100) / 100;
    const netBalance = Math.round((totalPaid - totalOwed) * 100) / 100;

    result.push({
      user_id: userId,
      profile: val.profile,
      total_paid: Math.round(val.paid * 100) / 100,
      total_owed: Math.round(val.owed * 100) / 100,
      net_balance: netBalance,
    });
  }

  return result;
}

/**
 * Greedy Debt Simplification Algorithm:
 * Minimizes total number of transactions required to settle all debts in O(N).
 */
export function simplifyDebts(
  balances: MemberBalance[],
  currencyCode: string = 'EUR'
): SimplifiedDebt[] {
  // Separate into debtors (net < 0) and creditors (net > 0)
  interface BalanceNode {
    userId: string;
    profile: Profile;
    amount: number; // positive value representing magnitude
  }

  const debtors: BalanceNode[] = [];
  const creditors: BalanceNode[] = [];

  for (const b of balances) {
    const rounded = Math.round(b.net_balance * 100) / 100;
    if (rounded < -0.01) {
      debtors.push({
        userId: b.user_id,
        profile: b.profile,
        amount: Math.abs(rounded),
      });
    } else if (rounded > 0.01) {
      creditors.push({
        userId: b.user_id,
        profile: b.profile,
        amount: rounded,
      });
    }
  }

  // Sort descending by amount for greedy matching
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions: SimplifiedDebt[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    // Settle the minimum of what debtor owes and creditor is owed
    const settledAmount = Math.round(Math.min(debtor.amount, creditor.amount) * 100) / 100;

    if (settledAmount > 0.01) {
      transactions.push({
        from_user_id: debtor.userId,
        to_user_id: creditor.userId,
        from_profile: debtor.profile,
        to_profile: creditor.profile,
        amount: settledAmount,
        currency: currencyCode,
      });
    }

    debtor.amount = Math.round((debtor.amount - settledAmount) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - settledAmount) * 100) / 100;

    if (debtor.amount <= 0.01) {
      dIdx++;
    }
    if (creditor.amount <= 0.01) {
      cIdx++;
    }
  }

  return transactions;
}

export type ExpensePaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING';

export interface ExpensePaymentInfo {
  status: ExpensePaymentStatus;
  paidCount: number;
  totalDebtors: number;
}

/**
 * Determines the payment/reimbursement status of an expense:
 * - 'PAID': All debtors have returned the money to the lender(s).
 * - 'PARTIAL': Some participants have paid, but others still owe.
 * - 'PENDING': No debtor has paid yet.
 */
export function getExpensePaymentStatus(expense: Expense): ExpensePaymentInfo {
  const participants = expense.participants || [];
  if (participants.length === 0) {
    return { status: 'PENDING', paidCount: 0, totalDebtors: 0 };
  }

  // Identify who the lenders / payers are
  const payers =
    expense.payers && expense.payers.length > 0
      ? expense.payers
      : [{ user_id: expense.created_by, amount_paid: expense.converted_amount || expense.amount }];

  const singlePayerId = payers.length === 1 ? payers[0].user_id : null;

  // Debtors are participants who owe money to the lender(s).
  // If there is a single payer (the most common case), the payer themselves is the lender,
  // so they are not their own debtor. All other participants with amount_owed > 0 are debtors.
  const debtors = participants.filter((p) => {
    if (Number(p.amount_owed) <= 0) return false;
    if (singlePayerId && p.user_id === singlePayerId) {
      return false;
    }
    if (payers.length > 1) {
      const payerRec = payers.find((pyr) => pyr.user_id === p.user_id);
      const paidAmt = payerRec ? Number(payerRec.amount_paid) : 0;
      if (paidAmt >= Number(p.amount_owed)) return false;
    }
    return true;
  });

  if (debtors.length === 0) {
    return { status: 'PAID', paidCount: 0, totalDebtors: 0 };
  }

  const paidCount = debtors.filter((d) => Boolean(d.has_paid)).length;
  const totalDebtors = debtors.length;

  let status: ExpensePaymentStatus = 'PENDING';
  if (paidCount === totalDebtors) {
    status = 'PAID';
  } else if (paidCount > 0) {
    status = 'PARTIAL';
  } else {
    status = 'PENDING';
  }

  return { status, paidCount, totalDebtors };
}

