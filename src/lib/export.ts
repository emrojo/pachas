import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Group, Expense, MemberBalance, SimplifiedDebt } from '@/types/database';
import { formatMoney, formatNumber } from '@/lib/currencies';
import { getCategoryInfo } from '@/lib/categories';
import { formatDate } from '@/lib/utils';

/**
 * Helper to safely compute converted amount in group base currency
 */
function getConvertedAmount(exp: Expense, baseCurrency: string): number {
  if (exp.currency === baseCurrency) {
    return exp.amount;
  }
  if (exp.converted_amount !== undefined && exp.converted_amount !== null && exp.converted_amount > 0) {
    return exp.converted_amount;
  }
  if (exp.exchange_rate && exp.exchange_rate > 0) {
    return Math.round((exp.amount / exp.exchange_rate) * 100) / 100;
  }
  return exp.amount;
}

export function exportGroupToCSV(group: Group, expenses: Expense[], balances: MemberBalance[]) {
  const baseCurrency = group.base_currency || 'EUR';
  let csvContent = 'data:text/csv;charset=utf-8,\uFEFF'; // UTF-8 BOM for Excel

  // 1. Group info
  csvContent += `RESUMEN DE GASTOS - ${group.name}\n`;
  csvContent += `Moneda base del viaje;${baseCurrency}\n`;
  csvContent += `Fecha de exportación;${formatDate(new Date().toISOString(), 'dd/MM/yyyy')}\n\n`;

  // 2. Expenses Table (Using semicolon separator which is standard for European Excel)
  csvContent += 'HISTORIAL DETALLADO DE GASTOS\n';
  csvContent += `Fecha;Concepto;Categoría;Importe Original;Divisa Original;Tipo de Cambio (1 ${baseCurrency});Importe en ${baseCurrency};Pagado Por;Participantes;Ubicación;Notas\n`;

  for (const exp of expenses) {
    const category = getCategoryInfo(exp.category).label;
    const converted = getConvertedAmount(exp, baseCurrency);

    const payers =
      exp.payers
        ?.map(
          (p) =>
            `${p.profile?.full_name || 'Amigo'} (${formatMoney(p.amount_paid, exp.currency)})`
        )
        .join(', ') || 'N/A';

    const participants =
      exp.participants
        ?.map(
          (p) =>
            `${p.profile?.full_name || 'Amigo'} (${formatMoney(p.amount_owed, baseCurrency)})`
        )
        .join(', ') || 'Todos';

    const rateStr = exp.exchange_rate ? formatNumber(exp.exchange_rate, 4) : '1,0000';
    const location = (exp.location_name || '').replace(/"/g, '""');
    const notes = (exp.notes || '').replace(/"/g, '""');
    const dateFormatted = formatDate(exp.expense_date, 'dd/MM/yyyy');

    csvContent += `"${dateFormatted}";"${exp.title.replace(/"/g, '""')}";"${category}";"${formatNumber(exp.amount)}";"${exp.currency}";"${rateStr}";"${formatNumber(converted)}";"${payers}";"${participants}";"${location}";"${notes}"\n`;
  }

  // 3. Balances
  csvContent += `\nSALDOS Y BALANCES (EN ${baseCurrency})\n`;
  csvContent += `Amigo / Participante;Total Pagado (${baseCurrency});Total Consumido (${baseCurrency});Saldo Neto (${baseCurrency})\n`;
  for (const b of balances) {
    csvContent += `"${b.profile.full_name}";"${formatNumber(b.total_paid)}";"${formatNumber(b.total_owed)}";"${formatNumber(b.net_balance)}"\n`;
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Pachas_${group.name.replace(/\s+/g, '_')}_gastos.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportGroupToPDF(
  group: Group,
  expenses: Expense[],
  balances: MemberBalance[],
  debts: SimplifiedDebt[]
) {
  const doc = new jsPDF();
  const baseCurrency = group.base_currency || 'EUR';

  // Total trip cost accurately converted in base currency
  const totalAmount = expenses.reduce((sum, e) => sum + getConvertedAmount(e, baseCurrency), 0);

  // 1. Header & Title Banner
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.rect(0, 0, 210, 38, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pachas: ${group.name}`, 14, 20);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Informe de Gastos y Liquidaciones | Moneda Base: ${baseCurrency} | ${formatDate(new Date().toISOString(), 'dd/MM/yyyy')}`,
    14,
    29
  );

  // 2. Summary Cards
  doc.setTextColor(33, 33, 33);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen General del Viaje', 14, 48);

  const summaryData = [
    [`Total Gastado (en ${baseCurrency})`, formatMoney(totalAmount, baseCurrency)],
    ['Número Total de Gastos', `${expenses.length} gastos registrados`],
    ['Participantes en el Grupo', `${balances.length} amigos`],
    ['Transferencias para Liquidar', `${debts.length} pagos necesarios`],
  ];

  autoTable(doc, {
    startY: 52,
    head: [['Métrica', 'Valor']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
    styles: { fontSize: 10, cellPadding: 3.5 },
  });

  // 3. Balances Table
  let currentY = (doc as any).lastAutoTable.finalY + 12;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Saldos por Participante (en ${baseCurrency})`, 14, currentY);

  const balancesData = balances.map((b) => [
    b.profile.full_name,
    formatMoney(b.total_paid, baseCurrency),
    formatMoney(b.total_owed, baseCurrency),
    (b.net_balance >= 0 ? '+' : '') + formatMoney(b.net_balance, baseCurrency),
  ]);

  autoTable(doc, {
    startY: currentY + 4,
    head: [[
      'Participante',
      `Total Pagado (${baseCurrency})`,
      `Total Consumido (${baseCurrency})`,
      `Saldo Neto (${baseCurrency})`
    ]],
    body: balancesData,
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255] },
    styles: { fontSize: 9.5, cellPadding: 3 },
  });

  // 4. Simplified Debts Table
  currentY = (doc as any).lastAutoTable.finalY + 12;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Propuesta de Liquidación (Quién paga a quién en ${baseCurrency})`, 14, currentY);

  const debtsData =
    debts.length > 0
      ? debts.map((d) => [
          d.from_profile.full_name,
          'Paga a',
          d.to_profile.full_name,
          formatMoney(d.amount, baseCurrency),
          d.to_profile.bizum_phone ? `Bizum: ${d.to_profile.bizum_phone}` : 'Efectivo / Transferencia',
        ])
      : [['Todo el mundo está en paz', '-', '-', formatMoney(0, baseCurrency), 'Sin deudas pendientes']];

  autoTable(doc, {
    startY: currentY + 4,
    head: [['Deudor', 'Acción', 'Beneficiario', `Importe (${baseCurrency})`, 'Método Sugerido']],
    body: debtsData,
    theme: 'striped',
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255] },
    styles: { fontSize: 9.5, cellPadding: 3 },
  });

  // 5. Detailed Expenses Table (New Page)
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('Desglose Detallado de Gastos', 14, 18);

  const expensesData = expenses.map((e) => {
    const cat = getCategoryInfo(e.category);
    const payerStr = e.payers?.map((p) => p.profile?.full_name).join(', ') || 'N/A';
    const converted = getConvertedAmount(e, baseCurrency);
    const isForeign = e.currency !== baseCurrency;

    const originalAmountStr = formatMoney(e.amount, e.currency);
    const convertedAmountStr = formatMoney(converted, baseCurrency);

    return [
      formatDate(e.expense_date, 'dd/MM/yyyy'),
      e.title,
      cat.label,
      payerStr,
      isForeign ? originalAmountStr : '-',
      convertedAmountStr,
    ];
  });

  autoTable(doc, {
    startY: 24,
    head: [[
      'Fecha',
      'Concepto',
      'Categoría',
      'Pagado Por',
      'Importe Original',
      `Importe (${baseCurrency})`
    ]],
    body: expensesData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
    styles: { fontSize: 8.5, cellPadding: 2.8 },
  });

  // Save PDF
  doc.save(`Pachas_${group.name.replace(/\s+/g, '_')}_informe.pdf`);
}
