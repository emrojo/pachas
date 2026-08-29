import { Expense, GroupMember, Settlement, SimplifiedDebt } from '@/types/database';
import { calculateBalances, simplifyDebts } from '@/lib/algorithms/simplifyDebts';
import { formatMoney } from '@/lib/currencies';
import { formatDate } from '@/lib/utils';

export type AuditStepType =
  | 'intro'
  | 'payment'
  | 'payments_summary'
  | 'consumption'
  | 'consumptions_summary'
  | 'gross_balance'
  | 'settlement'
  | 'final_net';

export interface AuditStep {
  id: string;
  stepIndex: number;
  type: AuditStepType;
  title: string;
  subtitle?: string;
  phase: number;
  phaseTitleKey: string;
  date?: string;
  categoryEmoji?: string;
  relatedExpense?: Expense;
  relatedSettlement?: Settlement;
  formulaDisplay: string;
  calculatorExpression: string;
  secondaryFormulaDisplay?: string;
  secondaryCalculatorExpression?: string;
  fullSumChainDisplay?: string;
  fullSumChainExpression?: string;
  stepAmount: number;
  runningPaid: number;
  runningConsumed: number;
  runningNet: number;
  explanation: string;
  splitDetails?: {
    splitMode: string;
    totalParticipants: number;
    totalAmount: number;
    userPortion: number;
  };
  debtPlan?: SimplifiedDebt[];
}

export function generateUserAuditTrail(
  userId: string,
  baseCurrency: string,
  members: GroupMember[],
  expenses: Expense[],
  settlements: Settlement[] = []
): AuditStep[] {
  const steps: AuditStep[] = [];
  const targetMember = members.find((m) => m.user_id === userId);
  const targetName = targetMember?.profile?.full_name || 'Usuario';

  // Overall group balances and debts
  const allBalances = calculateBalances(members, expenses, settlements);
  const userBalance = allBalances.find((b) => b.user_id === userId);
  const simplifiedDebts = simplifyDebts(allBalances);
  const userDebts = simplifiedDebts.filter(
    (d) => d.from_user_id === userId || d.to_user_id === userId
  );

  let runningPaid = 0;
  let runningConsumed = 0;
  let stepCounter = 1;

  // 1. STEP: INTRO
  const finalNet = userBalance?.net_balance || 0;
  steps.push({
    id: 'intro',
    stepIndex: stepCounter++,
    type: 'intro',
    title: `Auditoría de Cuentas: ${targetName}`,
    subtitle: `Moneda principal del viaje: ${baseCurrency}`,
    phase: 1,
    phaseTitleKey: 'audit.phaseIntro',
    formulaDisplay: `Saldo final a verificar: ${formatMoney(finalNet, baseCurrency)}`,
    calculatorExpression: `${finalNet}`,
    stepAmount: finalNet,
    runningPaid: 0,
    runningConsumed: 0,
    runningNet: 0,
    explanation:
      finalNet > 0.009
        ? `Al finalizar el cálculo, te corresponde COBRAR ${formatMoney(finalNet, baseCurrency)} del grupo.`
        : finalNet < -0.009
        ? `Al finalizar el cálculo, te corresponde PAGAR ${formatMoney(Math.abs(finalNet), baseCurrency)} al grupo.`
        : `Tus cuentas están perfectamente cuadradas (saldo de 0,00 ${baseCurrency}).`,
  });

  // Sort expenses chronologically
  const sortedExpenses = [...expenses].sort((a, b) => {
    const timeA = new Date(a.expense_date || a.created_at).getTime();
    const timeB = new Date(b.expense_date || b.created_at).getTime();
    return timeA - timeB;
  });

  // 2. PHASE: PAYMENTS MADE BY USER
  const userPayments = sortedExpenses.filter((e) => {
    if (e.payers && e.payers.length > 0) {
      return e.payers.some((p) => p.user_id === userId && Number(p.amount_paid) > 0);
    }
    return e.created_by === userId;
  });

  const paidAmountsList: number[] = [];

  for (const exp of userPayments) {
    const expenseBaseAmount = Number(exp.converted_amount) || Number(exp.amount) || 0;
    const expenseOrigAmount = Number(exp.amount) > 0 ? Number(exp.amount) : expenseBaseAmount;

    let userPaidInThisExpense = 0;
    let isMultiPayer = false;

    if (exp.payers && exp.payers.length > 0) {
      const payerEntry = exp.payers.find((p) => p.user_id === userId);
      if (payerEntry) {
        const rawPaid = Number(payerEntry.amount_paid);
        userPaidInThisExpense = (rawPaid / (expenseOrigAmount || 1)) * expenseBaseAmount;
        isMultiPayer = exp.payers.length > 1;
      }
    } else if (exp.created_by === userId) {
      userPaidInThisExpense = expenseBaseAmount;
    }

    userPaidInThisExpense = Math.round(userPaidInThisExpense * 100) / 100;
    paidAmountsList.push(userPaidInThisExpense);

    const prevPaid = runningPaid;
    runningPaid = Math.round((runningPaid + userPaidInThisExpense) * 100) / 100;

    const formattedDate = formatDate(exp.expense_date || exp.created_at, 'dd/MM/yyyy');
    const calcExpr = `${prevPaid} + ${userPaidInThisExpense}`;

    steps.push({
      id: `payment-${exp.id}`,
      stepIndex: stepCounter++,
      type: 'payment',
      title: exp.title,
      subtitle: `Adelantaste: ${formatMoney(userPaidInThisExpense, baseCurrency)} ${
        isMultiPayer ? '(Pago compartido)' : '(Pago único)'
      }`,
      phase: 2,
      phaseTitleKey: 'audit.phasePayments',
      date: formattedDate,
      categoryEmoji: exp.category,
      relatedExpense: exp,
      formulaDisplay: `${formatMoney(prevPaid, baseCurrency)} + ${formatMoney(
        userPaidInThisExpense,
        baseCurrency
      )} = ${formatMoney(runningPaid, baseCurrency)}`,
      calculatorExpression: calcExpr,
      stepAmount: userPaidInThisExpense,
      runningPaid,
      runningConsumed,
      runningNet: Math.round((runningPaid - runningConsumed) * 100) / 100,
      explanation: isMultiPayer
        ? `Adelantaste ${formatMoney(userPaidInThisExpense, baseCurrency)} de un ticket total de ${formatMoney(
            expenseBaseAmount,
            baseCurrency
          )}.`
        : `Pagaste la totalidad del gasto (${formatMoney(expenseBaseAmount, baseCurrency)}).`,
    });
  }

  // Summary step for payments if multiple
  if (paidAmountsList.length > 1) {
    const sumChainDisplay = paidAmountsList.map((a) => formatMoney(a, baseCurrency)).join(' + ') + ` = ${formatMoney(runningPaid, baseCurrency)}`;
    const sumChainExpr = paidAmountsList.join(' + ');

    steps.push({
      id: 'payments-summary',
      stepIndex: stepCounter++,
      type: 'payments_summary',
      title: 'Suma Total de Pagos Realizados',
      subtitle: `Total acumulado que adelantaste para el grupo: ${formatMoney(runningPaid, baseCurrency)}`,
      phase: 2,
      phaseTitleKey: 'audit.phasePayments',
      formulaDisplay: sumChainDisplay,
      calculatorExpression: sumChainExpr,
      stepAmount: runningPaid,
      runningPaid,
      runningConsumed,
      runningNet: Math.round((runningPaid - runningConsumed) * 100) / 100,
      explanation: `Has completado el registro de todos tus pagos adelantados (${paidAmountsList.length} asientos). La suma total que has puesto para el grupo asciende a ${formatMoney(runningPaid, baseCurrency)}.`,
    });
  }

  // 3. PHASE: CONSUMPTIONS / SHARES PARTICIPATED BY USER
  const userConsumptions = sortedExpenses.filter((e) => {
    if (e.participants && e.participants.length > 0) {
      return e.participants.some((p) => p.user_id === userId && Number(p.amount_owed) > 0);
    }
    return false;
  });

  const consumedAmountsList: number[] = [];

  for (const exp of userConsumptions) {
    const partEntry = exp.participants?.find((p) => p.user_id === userId);
    const userPortion = Math.round((Number(partEntry?.amount_owed) || 0) * 100) / 100;
    consumedAmountsList.push(userPortion);

    const prevConsumed = runningConsumed;
    runningConsumed = Math.round((runningConsumed + userPortion) * 100) / 100;

    const totalParticipants = exp.participants?.length || 1;
    const expenseBaseAmount = Number(exp.converted_amount) || Number(exp.amount) || 0;
    const splitType = exp.split_type || 'EQUAL';

    // Step A: Division / Portion Calculation
    let splitFormula = '';
    let splitCalcExpr = '';

    if (splitType === 'EQUAL' || (splitType as string).toLowerCase() === 'equal') {
      splitFormula = `${formatMoney(expenseBaseAmount, baseCurrency)} ÷ ${totalParticipants} = ${formatMoney(
        userPortion,
        baseCurrency
      )}`;
      splitCalcExpr = `${expenseBaseAmount} / ${totalParticipants}`;
    } else {
      splitFormula = `Cuota según reparto (${splitType}): ${formatMoney(userPortion, baseCurrency)}`;
      splitCalcExpr = `${userPortion}`;
    }

    // Step B: Addition to running total consumed
    const sumFormula = `${formatMoney(prevConsumed, baseCurrency)} + ${formatMoney(
      userPortion,
      baseCurrency
    )} = ${formatMoney(runningConsumed, baseCurrency)}`;
    const sumCalcExpr = `${prevConsumed} + ${userPortion}`;

    const formattedDate = formatDate(exp.expense_date || exp.created_at, 'dd/MM/yyyy');

    steps.push({
      id: `consumption-${exp.id}`,
      stepIndex: stepCounter++,
      type: 'consumption',
      title: exp.title,
      subtitle: `Cuota de este gasto: ${formatMoney(userPortion, baseCurrency)}`,
      phase: 3,
      phaseTitleKey: 'audit.phaseConsumptions',
      date: formattedDate,
      categoryEmoji: exp.category,
      relatedExpense: exp,
      formulaDisplay: splitFormula,
      calculatorExpression: splitCalcExpr,
      secondaryFormulaDisplay: sumFormula,
      secondaryCalculatorExpression: sumCalcExpr,
      stepAmount: userPortion,
      runningPaid,
      runningConsumed,
      runningNet: Math.round((runningPaid - runningConsumed) * 100) / 100,
      explanation: `Tu cuota en este gasto es de ${formatMoney(
        userPortion,
        baseCurrency
      )}, que se añade a tu consumo previo (${formatMoney(prevConsumed, baseCurrency)}), alcanzando un consumo total acumulado de ${formatMoney(runningConsumed, baseCurrency)}.`,
      splitDetails: {
        splitMode: splitType,
        totalParticipants,
        totalAmount: expenseBaseAmount,
        userPortion,
      },
    });
  }

  // Summary step for consumptions if multiple
  if (consumedAmountsList.length > 1) {
    const sumChainDisplay = consumedAmountsList.map((a) => formatMoney(a, baseCurrency)).join(' + ') + ` = ${formatMoney(runningConsumed, baseCurrency)}`;
    const sumChainExpr = consumedAmountsList.join(' + ');

    steps.push({
      id: 'consumptions-summary',
      stepIndex: stepCounter++,
      type: 'consumptions_summary',
      title: 'Suma Total de Consumos Acumulados',
      subtitle: `Total acumulado que te corresponde asumir: ${formatMoney(runningConsumed, baseCurrency)}`,
      phase: 3,
      phaseTitleKey: 'audit.phaseConsumptions',
      formulaDisplay: sumChainDisplay,
      calculatorExpression: sumChainExpr,
      stepAmount: runningConsumed,
      runningPaid,
      runningConsumed,
      runningNet: Math.round((runningPaid - runningConsumed) * 100) / 100,
      explanation: `Has completado el desglose de todas tus cuotas de participación (${consumedAmountsList.length} gastos). La suma total de tu consumo individual asciende a ${formatMoney(runningConsumed, baseCurrency)}.`,
    });
  }

  // 4. PHASE: GROSS BALANCE (Total Paid - Total Consumed)
  const grossBalance = Math.round((runningPaid - runningConsumed) * 100) / 100;
  steps.push({
    id: 'gross_balance',
    stepIndex: stepCounter++,
    type: 'gross_balance',
    title: 'Cálculo del Balance Bruto',
    subtitle: 'Resta directa: Total Pagado - Total Consumido',
    phase: 4,
    phaseTitleKey: 'audit.phaseGrossBalance',
    formulaDisplay: `${formatMoney(runningPaid, baseCurrency)} - ${formatMoney(
      runningConsumed,
      baseCurrency
    )} = ${formatMoney(grossBalance, baseCurrency)}`,
    calculatorExpression: `${runningPaid} - ${runningConsumed}`,
    stepAmount: grossBalance,
    runningPaid,
    runningConsumed,
    runningNet: grossBalance,
    explanation:
      grossBalance > 0
        ? `Has adelantado ${formatMoney(runningPaid, baseCurrency)} y consumido ${formatMoney(
            runningConsumed,
            baseCurrency
          )}. Tu saldo bruto a favor es de +${formatMoney(grossBalance, baseCurrency)}.`
        : grossBalance < 0
        ? `Has adelantado ${formatMoney(runningPaid, baseCurrency)} pero tu consumo total es de ${formatMoney(
            runningConsumed,
            baseCurrency
          )}. Tu saldo bruto deudor es de ${formatMoney(grossBalance, baseCurrency)}.`
        : `Tus pagos coinciden exactamente con tu consumo (${formatMoney(runningPaid, baseCurrency)}).`,
  });

  // 5. PHASE: SETTLEMENTS (Direct Bizums / transfers)
  const userSettlements = settlements.filter(
    (s) => s.from_user_id === userId || s.to_user_id === userId
  );

  let runningNet = grossBalance;

  for (const s of userSettlements) {
    const isSent = s.from_user_id === userId;
    const amount = Number(s.amount) || 0;
    const prevNet = runningNet;

    // If user sent money, debt decreases (net balance increases)
    // If user received money, credit decreases (net balance decreases)
    runningNet = isSent ? runningNet + amount : runningNet - amount;
    runningNet = Math.round(runningNet * 100) / 100;

    const otherProfile = isSent ? s.to_profile : s.from_profile;
    const otherName = otherProfile?.full_name || 'Compañero';
    const actionText = isSent
      ? `Pagaste a ${otherName} vía ${s.payment_method}`
      : `Recibiste de ${otherName} vía ${s.payment_method}`;

    steps.push({
      id: `settlement-${s.id}`,
      stepIndex: stepCounter++,
      type: 'settlement',
      title: actionText,
      subtitle: `${isSent ? '+ Pagado' : '- Cobrado'}: ${formatMoney(amount, baseCurrency)}`,
      phase: 5,
      phaseTitleKey: 'audit.phaseSettlements',
      date: formatDate(s.settled_at, 'dd/MM/yyyy HH:mm'),
      relatedSettlement: s,
      formulaDisplay: `${formatMoney(prevNet, baseCurrency)} ${isSent ? '+' : '-'} ${formatMoney(
        amount,
        baseCurrency
      )} = ${formatMoney(runningNet, baseCurrency)}`,
      calculatorExpression: `${prevNet} ${isSent ? '+' : '-'} ${amount}`,
      stepAmount: amount,
      runningPaid,
      runningConsumed,
      runningNet,
      explanation: isSent
        ? `Enviaste un Bizum/pago directo de ${formatMoney(amount, baseCurrency)}, reduciendo tu deuda pendiente.`
        : `Recibiste un Bizum/pago de ${formatMoney(amount, baseCurrency)}, ajustando el saldo pendiente a tu favor.`,
    });
  }

  // 6. PHASE: FINAL NET BALANCE & SIMPLIFIED DEBT SETTLEMENT PLAN
  steps.push({
    id: 'final_net',
    stepIndex: stepCounter++,
    type: 'final_net',
    title: 'Resultado Final y Plan de Liquidación',
    subtitle: `Saldo Neto Definitivo: ${formatMoney(runningNet, baseCurrency)}`,
    phase: 6,
    phaseTitleKey: 'audit.phaseFinalDebts',
    formulaDisplay: `Saldo comprobado = ${formatMoney(runningNet, baseCurrency)}`,
    calculatorExpression: `${runningNet}`,
    stepAmount: runningNet,
    runningPaid,
    runningConsumed,
    runningNet,
    explanation:
      runningNet < -0.009
        ? `Debes pagar un total de ${formatMoney(Math.abs(runningNet), baseCurrency)} para saldar tus cuentas.`
        : runningNet > 0.009
        ? `Te corresponde recibir un total de ${formatMoney(runningNet, baseCurrency)}.`
        : `Tus cuentas en el grupo están 100% saldadas.`,
    debtPlan: userDebts,
  });

  return steps;
}
