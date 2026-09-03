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

export interface CurrencyConversionInfo {
  isForeignCurrency: boolean;
  originalAmount: number;
  originalCurrency: string;
  baseCurrency: string;
  exchangeRate: number;
  convertedAmount: number;
  conversionFormulaDisplay: string;
  conversionCalcExpr: string;
}

export interface FinalSettlementProof {
  isCreditor: boolean;
  isDebtor: boolean;
  isSettled: boolean;
  totalSettlementAmount: number;
  sumFormulaDisplay: string;
  sumCalcExpr: string;
  zeroingFormulaDisplay: string;
  zeroingCalcExpr: string;
  items: Array<{
    otherName: string;
    amount: number;
    isIncoming: boolean;
  }>;
}

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
  conversionInfo?: CurrencyConversionInfo;
  finalSettlementProof?: FinalSettlementProof;
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
    originalTotalAmount?: number;
    originalCurrency?: string;
    userPortion: number;
  };
  debtPlan?: SimplifiedDebt[];
}

function getConversionInfo(
  exp: Expense,
  baseCurrency: string
): CurrencyConversionInfo | undefined {
  const isForeign =
    Boolean(exp.currency) &&
    exp.currency.toUpperCase() !== baseCurrency.toUpperCase();

  if (!isForeign) return undefined;

  const originalAmount = Number(exp.amount) || 0;
  const convertedAmount = Number(exp.converted_amount) || originalAmount;
  const rate =
    Number(exp.exchange_rate) ||
    (originalAmount > 0 ? convertedAmount / originalAmount : 1);
  const roundedRate = Math.round(rate * 10000) / 10000;

  const conversionFormulaDisplay = `${formatMoney(
    originalAmount,
    exp.currency
  )} × ${roundedRate} = ${formatMoney(convertedAmount, baseCurrency)}`;
  const conversionCalcExpr = `${originalAmount} * ${roundedRate}`;

  return {
    isForeignCurrency: true,
    originalAmount,
    originalCurrency: exp.currency,
    baseCurrency,
    exchangeRate: roundedRate,
    convertedAmount,
    conversionFormulaDisplay,
    conversionCalcExpr,
  };
}

export function generateUserAuditTrail(
  userId: string,
  baseCurrency: string,
  members: GroupMember[],
  expenses: Expense[],
  settlements: Settlement[] = [],
  t?: (key: string, params?: Record<string, any>) => string
): AuditStep[] {
  const tr = (key: string, params?: Record<string, any>, fallback = ''): string => {
    if (t) {
      const res = t(key, params);
      if (res && res !== key) return res;
    }
    return fallback;
  };

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
    title: tr('audit.stepIntroTitle', { name: targetName }, `Auditoría de Cuentas: ${targetName}`),
    subtitle: tr('audit.stepIntroSubtitle', { currency: baseCurrency }, `Moneda principal del viaje: ${baseCurrency}`),
    phase: 1,
    phaseTitleKey: 'audit.phaseIntro',
    formulaDisplay: tr('audit.stepIntroFormula', { amount: formatMoney(finalNet, baseCurrency) }, `Saldo final a verificar: ${formatMoney(finalNet, baseCurrency)}`),
    calculatorExpression: `${finalNet}`,
    stepAmount: finalNet,
    runningPaid: 0,
    runningConsumed: 0,
    runningNet: 0,
    explanation:
      finalNet > 0.009
        ? tr('audit.introCollect', { amount: formatMoney(finalNet, baseCurrency) }, `Al finalizar el cálculo, te corresponde COBRAR ${formatMoney(finalNet, baseCurrency)} del grupo.`)
        : finalNet < -0.009
        ? tr('audit.introPay', { amount: formatMoney(Math.abs(finalNet), baseCurrency) }, `Al finalizar el cálculo, te corresponde PAGAR ${formatMoney(Math.abs(finalNet), baseCurrency)} al grupo.`)
        : tr('audit.introBalanced', { currency: baseCurrency }, `Tus cuentas están perfectamente cuadradas (saldo de 0,00 ${baseCurrency}).`),
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
    const conversion = getConversionInfo(exp, baseCurrency);

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

    // Detailed Natural Language explanation with original ticket value
    let explanation = '';
    if (conversion) {
      if (isMultiPayer) {
        explanation = tr(
          'audit.paymentMultiForeign',
          {
            title: exp.title,
            origAmount: formatMoney(conversion.originalAmount, conversion.originalCurrency),
            rate: conversion.exchangeRate,
            convAmount: formatMoney(conversion.convertedAmount, baseCurrency),
            userPortion: formatMoney(userPaidInThisExpense, baseCurrency),
            prevPaid: formatMoney(prevPaid, baseCurrency),
            runningPaid: formatMoney(runningPaid, baseCurrency),
          },
          `Este gasto (${exp.title}) se pagó originalmente en divisa extranjera con un ticket total de ${formatMoney(
            conversion.originalAmount,
            conversion.originalCurrency
          )}. Aplicando el tipo de cambio acordado de ${conversion.exchangeRate} (${formatMoney(
            conversion.originalAmount,
            conversion.originalCurrency
          )} × ${conversion.exchangeRate} = ${formatMoney(
            conversion.convertedAmount,
            baseCurrency
          )}), tu aportación compartida equivale a ${formatMoney(
            userPaidInThisExpense,
            baseCurrency
          )}. Al sumarse a tus pagos anteriores (${formatMoney(
            prevPaid,
            baseCurrency
          )}), tu total adelantado asciende a ${formatMoney(runningPaid, baseCurrency)}.`
        );
      } else {
        explanation = tr(
          'audit.paymentSingleForeign',
          {
            title: exp.title,
            origAmount: formatMoney(conversion.originalAmount, conversion.originalCurrency),
            rate: conversion.exchangeRate,
            convAmount: formatMoney(conversion.convertedAmount, baseCurrency),
            userPortion: formatMoney(userPaidInThisExpense, baseCurrency),
            prevPaid: formatMoney(prevPaid, baseCurrency),
            runningPaid: formatMoney(runningPaid, baseCurrency),
          },
          `Pagaste la totalidad de este gasto (${exp.title}) en divisa extranjera por un ticket original de ${formatMoney(
            conversion.originalAmount,
            conversion.originalCurrency
          )}. Con el tipo de cambio acordado de ${conversion.exchangeRate} (${formatMoney(
            conversion.originalAmount,
            conversion.originalCurrency
          )} × ${conversion.exchangeRate} = ${formatMoney(
            conversion.convertedAmount,
            baseCurrency
          )}), tu aportación convertida es de ${formatMoney(
            userPaidInThisExpense,
            baseCurrency
          )}. Al sumarse a tus pagos anteriores (${formatMoney(
            prevPaid,
            baseCurrency
          )}), tu total adelantado asciende a ${formatMoney(runningPaid, baseCurrency)}.`
        );
      }
    } else {
      if (isMultiPayer) {
        explanation = tr(
          'audit.paymentMultiBase',
          {
            title: exp.title,
            origAmount: formatMoney(expenseBaseAmount, baseCurrency),
            userPortion: formatMoney(userPaidInThisExpense, baseCurrency),
            prevPaid: formatMoney(prevPaid, baseCurrency),
            runningPaid: formatMoney(runningPaid, baseCurrency),
          },
          `En este gasto (${exp.title}) el ticket original pagado fue de ${formatMoney(
            expenseBaseAmount,
            baseCurrency
          )}. Adelantaste ${formatMoney(
            userPaidInThisExpense,
            baseCurrency
          )} en pago compartido. Al sumarse a tus pagos previos (${formatMoney(
            prevPaid,
            baseCurrency
          )}), tu total adelantado para el grupo asciende a ${formatMoney(
            runningPaid,
            baseCurrency
          )}.`
        );
      } else {
        explanation = tr(
          'audit.paymentSingleBase',
          {
            title: exp.title,
            origAmount: formatMoney(expenseBaseAmount, baseCurrency),
            prevPaid: formatMoney(prevPaid, baseCurrency),
            runningPaid: formatMoney(runningPaid, baseCurrency),
          },
          `En este gasto (${exp.title}) el ticket original pagado fue de ${formatMoney(
            expenseBaseAmount,
            baseCurrency
          )}. Pagaste la totalidad del importe. Al sumarse a tus pagos anteriores (${formatMoney(
            prevPaid,
            baseCurrency
          )}), tu total adelantado asciende a ${formatMoney(runningPaid, baseCurrency)}.`
        );
      }
    }

    steps.push({
      id: `payment-${exp.id}`,
      stepIndex: stepCounter++,
      type: 'payment',
      title: exp.title,
      subtitle: `${tr('audit.youAdvanced', {}, 'Adelantaste')}: ${formatMoney(userPaidInThisExpense, baseCurrency)} ${
        isMultiPayer
          ? `(${tr('audit.sharedPayment', {}, 'Pago compartido')})`
          : `(${tr('audit.singlePayment', {}, 'Pago único')})`
      }`,
      phase: 2,
      phaseTitleKey: 'audit.phasePayments',
      date: formattedDate,
      categoryEmoji: exp.category,
      relatedExpense: exp,
      conversionInfo: conversion,
      formulaDisplay: `${formatMoney(prevPaid, baseCurrency)} + ${formatMoney(
        userPaidInThisExpense,
        baseCurrency
      )} = ${formatMoney(runningPaid, baseCurrency)}`,
      calculatorExpression: calcExpr,
      stepAmount: userPaidInThisExpense,
      runningPaid,
      runningConsumed,
      runningNet: Math.round((runningPaid - runningConsumed) * 100) / 100,
      explanation,
    });
  }

  // Summary step for payments if multiple
  if (paidAmountsList.length > 1) {
    const sumChainDisplay =
      paidAmountsList.map((a) => formatMoney(a, baseCurrency)).join(' + ') +
      ` = ${formatMoney(runningPaid, baseCurrency)}`;
    const sumChainExpr = paidAmountsList.join(' + ');

    steps.push({
      id: 'payments-summary',
      stepIndex: stepCounter++,
      type: 'payments_summary',
      title: tr('audit.totalPaymentsSummary', {}, 'Suma Total de Pagos Realizados'),
      subtitle: `${tr('audit.totalAccumulatedAdvanced', {}, 'Total acumulado que adelantaste para el grupo')}: ${formatMoney(
        runningPaid,
        baseCurrency
      )}`,
      phase: 2,
      phaseTitleKey: 'audit.phasePayments',
      formulaDisplay: sumChainDisplay,
      calculatorExpression: sumChainExpr,
      stepAmount: runningPaid,
      runningPaid,
      runningConsumed,
      runningNet: Math.round((runningPaid - runningConsumed) * 100) / 100,
      explanation: tr(
        'audit.paymentsSummaryExplanation',
        { count: paidAmountsList.length, total: formatMoney(runningPaid, baseCurrency) },
        `Has completado el registro de todos tus pagos adelantados (${paidAmountsList.length} asientos). La suma total que has puesto para el grupo asciende a ${formatMoney(
          runningPaid,
          baseCurrency
        )}.`
      ),
    });
  }

  // 3. PHASE: CONSUMPTIONS / SHARES PARTICIPATED BY USER
  const userConsumptions = sortedExpenses.filter((e) => {
    if (e.participants && e.participants.length > 0) {
      return e.participants.some(
        (p) => p.user_id === userId && Number(p.amount_owed) > 0
      );
    }
    return false;
  });

  const consumedAmountsList: number[] = [];

  for (const exp of userConsumptions) {
    const partEntry = exp.participants?.find((p) => p.user_id === userId);
    const userPortion =
      Math.round((Number(partEntry?.amount_owed) || 0) * 100) / 100;
    consumedAmountsList.push(userPortion);

    const prevConsumed = runningConsumed;
    runningConsumed = Math.round((runningConsumed + userPortion) * 100) / 100;

    const totalParticipants = exp.participants?.length || 1;
    const expenseBaseAmount =
      Number(exp.converted_amount) || Number(exp.amount) || 0;
    const splitType = exp.split_type || 'EQUAL';
    const conversion = getConversionInfo(exp, baseCurrency);

    // Step A: Division / Portion Calculation
    let splitFormula = '';
    let splitCalcExpr = '';

    if (splitType === 'EQUAL' || (splitType as string).toLowerCase() === 'equal') {
      splitFormula = `${formatMoney(
        expenseBaseAmount,
        baseCurrency
      )} ÷ ${totalParticipants} = ${formatMoney(userPortion, baseCurrency)}`;
      splitCalcExpr = `${expenseBaseAmount} / ${totalParticipants}`;
    } else {
      splitFormula = `Cuota según reparto (${splitType}): ${formatMoney(
        userPortion,
        baseCurrency
      )}`;
      splitCalcExpr = `${userPortion}`;
    }

    // Step B: Addition to running total consumed
    const sumFormula = `${formatMoney(
      prevConsumed,
      baseCurrency
    )} + ${formatMoney(userPortion, baseCurrency)} = ${formatMoney(
      runningConsumed,
      baseCurrency
    )}`;
    const sumCalcExpr = `${prevConsumed} + ${userPortion}`;

    const formattedDate = formatDate(
      exp.expense_date || exp.created_at,
      'dd/MM/yyyy'
    );

    const splitLabel =
      splitType === 'EQUAL' || (splitType as string).toLowerCase() === 'equal'
        ? tr('audit.splitEqual', { count: totalParticipants }, `a partes iguales entre ${totalParticipants} amigos`)
        : tr('audit.splitCustom', { mode: splitType }, `según reparto ${splitType}`);

    // Natural Language explanation with original ticket value and conversion
    let explanation = '';
    if (conversion) {
      explanation = tr(
        'audit.consumptionForeign',
        {
          title: exp.title,
          origAmount: formatMoney(conversion.originalAmount, conversion.originalCurrency),
          rate: conversion.exchangeRate,
          convAmount: formatMoney(conversion.convertedAmount, baseCurrency),
          splitLabel,
          userPortion: formatMoney(userPortion, baseCurrency),
          prevConsumed: formatMoney(prevConsumed, baseCurrency),
          runningConsumed: formatMoney(runningConsumed, baseCurrency),
        },
        `En este gasto (${exp.title}) el valor original del ticket pagado fue de ${formatMoney(
          conversion.originalAmount,
          conversion.originalCurrency
        )}. Con el tipo de cambio acordado de ${conversion.exchangeRate} (${formatMoney(
          conversion.originalAmount,
          conversion.originalCurrency
        )} × ${conversion.exchangeRate} = ${formatMoney(
          conversion.convertedAmount,
          baseCurrency
        )}), el importe en la moneda del viaje es ${formatMoney(
          conversion.convertedAmount,
          baseCurrency
        )}. Al repartirse ${splitLabel}, te corresponde una cuota de consumo de ${formatMoney(
          userPortion,
          baseCurrency
        )}. Al añadir esta cuota a tu consumo previo (${formatMoney(
          prevConsumed,
          baseCurrency
        )}), tu consumo total acumulado asciende a ${formatMoney(
          runningConsumed,
          baseCurrency
        )}.`
      );
    } else {
      explanation = tr(
        'audit.consumptionBase',
        {
          title: exp.title,
          origAmount: formatMoney(expenseBaseAmount, baseCurrency),
          splitLabel,
          userPortion: formatMoney(userPortion, baseCurrency),
          prevConsumed: formatMoney(prevConsumed, baseCurrency),
          runningConsumed: formatMoney(runningConsumed, baseCurrency),
        },
        `En este gasto (${exp.title}) el valor original total pagado fue de ${formatMoney(
          expenseBaseAmount,
          baseCurrency
        )}, repartido ${splitLabel}. Te corresponde una cuota de consumo de ${formatMoney(
          userPortion,
          baseCurrency
        )}. Al añadir esta cuota a tu consumo previo (${formatMoney(
          prevConsumed,
          baseCurrency
        )}), tu consumo total acumulado asciende a ${formatMoney(
          runningConsumed,
          baseCurrency
        )}.`
      );
    }

    steps.push({
      id: `consumption-${exp.id}`,
      stepIndex: stepCounter++,
      type: 'consumption',
      title: exp.title,
      subtitle: `${tr('audit.shareOfThisExpense', {}, 'Cuota de este gasto')}: ${formatMoney(userPortion, baseCurrency)}`,
      phase: 3,
      phaseTitleKey: 'audit.phaseConsumptions',
      date: formattedDate,
      categoryEmoji: exp.category,
      relatedExpense: exp,
      conversionInfo: conversion,
      formulaDisplay: splitFormula,
      calculatorExpression: splitCalcExpr,
      secondaryFormulaDisplay: sumFormula,
      secondaryCalculatorExpression: sumCalcExpr,
      stepAmount: userPortion,
      runningPaid,
      runningConsumed,
      runningNet: Math.round((runningPaid - runningConsumed) * 100) / 100,
      explanation,
      splitDetails: {
        splitMode: splitType,
        totalParticipants,
        totalAmount: expenseBaseAmount,
        originalTotalAmount: conversion ? conversion.originalAmount : expenseBaseAmount,
        originalCurrency: conversion ? conversion.originalCurrency : baseCurrency,
        userPortion,
      },
    });
  }

  // Summary step for consumptions if multiple
  if (consumedAmountsList.length > 1) {
    const sumChainDisplay =
      consumedAmountsList.map((a) => formatMoney(a, baseCurrency)).join(' + ') +
      ` = ${formatMoney(runningConsumed, baseCurrency)}`;
    const sumChainExpr = consumedAmountsList.join(' + ');

    steps.push({
      id: 'consumptions-summary',
      stepIndex: stepCounter++,
      type: 'consumptions_summary',
      title: tr('audit.totalConsumptionsSummary', {}, 'Suma Total de Consumos Acumulados'),
      subtitle: `${tr('audit.totalAccumulatedAssumed', {}, 'Total acumulado que te corresponde asumir')}: ${formatMoney(
        runningConsumed,
        baseCurrency
      )}`,
      phase: 3,
      phaseTitleKey: 'audit.phaseConsumptions',
      formulaDisplay: sumChainDisplay,
      calculatorExpression: sumChainExpr,
      stepAmount: runningConsumed,
      runningPaid,
      runningConsumed,
      runningNet: Math.round((runningPaid - runningConsumed) * 100) / 100,
      explanation: tr(
        'audit.consumptionsSummaryExplanation',
        { count: consumedAmountsList.length, total: formatMoney(runningConsumed, baseCurrency) },
        `Has completado el desglose de todas tus cuotas de participación (${consumedAmountsList.length} gastos). La suma total de tu consumo individual asciende a ${formatMoney(
          runningConsumed,
          baseCurrency
        )}.`
      ),
    });
  }

  // 4. PHASE: GROSS BALANCE (Total Paid - Total Consumed)
  const grossBalance = Math.round((runningPaid - runningConsumed) * 100) / 100;
  steps.push({
    id: 'gross_balance',
    stepIndex: stepCounter++,
    type: 'gross_balance',
    title: tr('audit.grossBalanceTitle', {}, 'Cálculo del Balance Bruto'),
    subtitle: tr('audit.grossBalanceSubtitle', {}, 'Resta directa: Total Pagado - Total Consumido'),
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
        ? tr(
            'audit.grossBalancePositive',
            {
              paid: formatMoney(runningPaid, baseCurrency),
              consumed: formatMoney(runningConsumed, baseCurrency),
              net: formatMoney(grossBalance, baseCurrency),
            },
            `Has adelantado ${formatMoney(runningPaid, baseCurrency)} y consumido ${formatMoney(
              runningConsumed,
              baseCurrency
            )}. Tu saldo bruto a favor es de +${formatMoney(grossBalance, baseCurrency)}.`
          )
        : grossBalance < 0
        ? tr(
            'audit.grossBalanceNegative',
            {
              paid: formatMoney(runningPaid, baseCurrency),
              consumed: formatMoney(runningConsumed, baseCurrency),
              net: formatMoney(grossBalance, baseCurrency),
            },
            `Has adelantado ${formatMoney(runningPaid, baseCurrency)} pero tu consumo total es de ${formatMoney(
              runningConsumed,
              baseCurrency
            )}. Tu saldo bruto deudor es de ${formatMoney(grossBalance, baseCurrency)}.`
          )
        : tr(
            'audit.grossBalanceZero',
            { paid: formatMoney(runningPaid, baseCurrency) },
            `Tus pagos coinciden exactamente con tu consumo (${formatMoney(runningPaid, baseCurrency)}).`
          ),
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
      ? tr('audit.settlementSentTitle', { name: otherName, method: s.payment_method }, `Pagaste a ${otherName} vía ${s.payment_method}`)
      : tr('audit.settlementReceivedTitle', { name: otherName, method: s.payment_method }, `Recibiste de ${otherName} vía ${s.payment_method}`);

    const badgeLabel = isSent ? `+ ${tr('audit.paidBadge', {}, 'Pagado')}` : `- ${tr('audit.collectedBadge', {}, 'Cobrado')}`;

    steps.push({
      id: `settlement-${s.id}`,
      stepIndex: stepCounter++,
      type: 'settlement',
      title: actionText,
      subtitle: `${badgeLabel}: ${formatMoney(amount, baseCurrency)}`,
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
        ? tr(
            'audit.settlementSentExplanation',
            { amount: formatMoney(amount, baseCurrency) },
            `Enviaste un Bizum/pago directo de ${formatMoney(amount, baseCurrency)}, reduciendo tu deuda pendiente.`
          )
        : tr(
            'audit.settlementReceivedExplanation',
            { amount: formatMoney(amount, baseCurrency) },
            `Recibiste un Bizum/pago de ${formatMoney(amount, baseCurrency)}, ajustando el saldo pendiente a tu favor.`
          ),
    });
  }

  // 6. PHASE: FINAL NET BALANCE & SIMPLIFIED DEBT SETTLEMENT PLAN
  let finalProof: FinalSettlementProof | undefined = undefined;
  const allSettledBadge = tr('audit.allSettledBadge', {}, 'Cuentas 100% Cuadradas');

  if (Math.abs(runningNet) > 0.009 && userDebts.length > 0) {
    const isCreditor = runningNet > 0.009;
    const isDebtor = runningNet < -0.009;
    const absNet = Math.abs(runningNet);

    const items = userDebts.map((d) => {
      const isIncoming = d.to_user_id === userId;
      const otherProfile = isIncoming ? d.from_profile : d.to_profile;
      const otherName = otherProfile?.full_name || 'Compañero';
      return {
        otherName,
        amount: d.amount,
        isIncoming,
      };
    });

    const sumAmounts = items.map((i) => i.amount);
    const sumTotal =
      Math.round(sumAmounts.reduce((acc, curr) => acc + curr, 0) * 100) / 100;
    const sumFormulaDisplay =
      items
        .map((i) => `${i.otherName} (${formatMoney(i.amount, baseCurrency)})`)
        .join(' + ') + ` = ${formatMoney(sumTotal, baseCurrency)}`;
    const sumCalcExpr = sumAmounts.join(' + ');

    let zeroingFormulaDisplay = '';
    let zeroingCalcExpr = '';

    if (isCreditor) {
      zeroingFormulaDisplay = `${formatMoney(
        runningNet,
        baseCurrency
      )} - ${formatMoney(sumTotal, baseCurrency)} = ${formatMoney(
        0,
        baseCurrency
      )} (${allSettledBadge})`;
      zeroingCalcExpr = `${runningNet} - ${sumTotal}`;
    } else {
      zeroingFormulaDisplay = `-${formatMoney(
        absNet,
        baseCurrency
      )} + ${formatMoney(sumTotal, baseCurrency)} = ${formatMoney(
        0,
        baseCurrency
      )} (${allSettledBadge})`;
      zeroingCalcExpr = `-${absNet} + ${sumTotal}`;
    }

    finalProof = {
      isCreditor,
      isDebtor,
      isSettled: false,
      totalSettlementAmount: sumTotal,
      sumFormulaDisplay,
      sumCalcExpr,
      zeroingFormulaDisplay,
      zeroingCalcExpr,
      items,
    };
  } else {
    finalProof = {
      isCreditor: false,
      isDebtor: false,
      isSettled: true,
      totalSettlementAmount: 0,
      sumFormulaDisplay: `${formatMoney(0, baseCurrency)} = ${formatMoney(
        0,
        baseCurrency
      )}`,
      sumCalcExpr: '0',
      zeroingFormulaDisplay: `${formatMoney(
        0,
        baseCurrency
      )} = ${formatMoney(0, baseCurrency)} (${allSettledBadge})`,
      zeroingCalcExpr: '0',
      items: [],
    };
  }

  // Explanation for final step
  let finalExplanation = '';
  if (runningNet < -0.009) {
    const listStr =
      finalProof?.items
        .map((i) => tr('audit.toPayAction', { amount: formatMoney(i.amount, baseCurrency), name: i.otherName }, `pagar ${formatMoney(i.amount, baseCurrency)} a ${i.otherName}`))
        .join(', ') || '';
    finalExplanation = tr(
      'audit.finalNetDebtor',
      {
        net: formatMoney(Math.abs(runningNet), baseCurrency),
        list: listStr,
        total: formatMoney(finalProof.totalSettlementAmount, baseCurrency),
        currency: baseCurrency,
      },
      `Tu saldo neto deudor es de ${formatMoney(
        Math.abs(runningNet),
        baseCurrency
      )}. Para saldar tus cuentas debes ${listStr} (suma total de pagos: ${formatMoney(
        finalProof.totalSettlementAmount,
        baseCurrency
      )}). Al realizar estos pagos (-${formatMoney(
        Math.abs(runningNet),
        baseCurrency
      )} + ${formatMoney(
        finalProof.totalSettlementAmount,
        baseCurrency
      )}), tu saldo resultante pasa a ser exactamente de 0,00 ${baseCurrency}.`
    );
  } else if (runningNet > 0.009) {
    const listStr =
      finalProof?.items
        .map((i) => tr('audit.toReceiveAction', { amount: formatMoney(i.amount, baseCurrency), name: i.otherName }, `recibir ${formatMoney(i.amount, baseCurrency)} de ${i.otherName}`))
        .join(', ') || '';
    finalExplanation = tr(
      'audit.finalNetCreditor',
      {
        net: formatMoney(runningNet, baseCurrency),
        list: listStr,
        total: formatMoney(finalProof.totalSettlementAmount, baseCurrency),
        currency: baseCurrency,
      },
      `Tu saldo neto a favor es de +${formatMoney(
        runningNet,
        baseCurrency
      )}. Para saldar tus cuentas te corresponde ${listStr} (suma total de cobros: ${formatMoney(
        finalProof.totalSettlementAmount,
        baseCurrency
      )}). Al recibir estos cobros (+${formatMoney(
        runningNet,
        baseCurrency
      )} - ${formatMoney(
        finalProof.totalSettlementAmount,
        baseCurrency
      )}), tus cuentas quedan exactamente a 0,00 ${baseCurrency}.`
    );
  } else {
    finalExplanation = tr(
      'audit.finalNetZero',
      { currency: baseCurrency },
      `Tus cuentas en el grupo están 100% saldadas (saldo de 0,00 ${baseCurrency}) sin transferencias pendientes.`
    );
  }

  steps.push({
    id: 'final_net',
    stepIndex: stepCounter++,
    type: 'final_net',
    title: tr('audit.finalNetTitle', {}, 'Resultado Final y Plan de Liquidación'),
    subtitle: tr('audit.finalNetSubtitle', { net: formatMoney(runningNet, baseCurrency) }, `Saldo Neto Definitivo: ${formatMoney(runningNet, baseCurrency)}`),
    phase: 6,
    phaseTitleKey: 'audit.phaseFinalDebts',
    finalSettlementProof: finalProof,
    formulaDisplay: finalProof.sumFormulaDisplay,
    calculatorExpression: finalProof.sumCalcExpr,
    secondaryFormulaDisplay: finalProof.zeroingFormulaDisplay,
    secondaryCalculatorExpression: finalProof.zeroingCalcExpr,
    stepAmount: runningNet,
    runningPaid,
    runningConsumed,
    runningNet,
    explanation: finalExplanation,
    debtPlan: userDebts,
  });

  return steps;
}
