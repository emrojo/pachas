import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Group, Expense, MemberBalance, SimplifiedDebt } from '@/types/database';
import { formatMoney, formatNumber } from '@/lib/currencies';
import { getCategoryInfo } from '@/lib/categories';
import { formatDate } from '@/lib/utils';

/**
 * Strips emojis and non-standard characters that corrupt standard jsPDF WinAnsi / Latin-1 fonts
 */
export function cleanPdfText(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Emojis and surrogate pairs
    .replace(/[\u2600-\u27BF\uE000-\uF8FF\uFE00-\uFE0F\u200D]/g, '') // Symbols, variation selectors, ZWJ
    .replace(/\s+/g, ' ')
    .trim();
}

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
    return Math.round(exp.amount * exp.exchange_rate * 100) / 100;
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
  csvContent += `Fecha;Concepto;Categoría;Importe Original;Divisa Original;Tipo de Cambio (1 ${baseCurrency});Importe en ${baseCurrency};Pagado Por;Participantes;Establecimiento / Ubicación;Coordenadas;Enlace Google Maps;Notas\n`;

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
    const coordsStr =
      exp.latitude !== undefined && exp.latitude !== null && exp.longitude !== undefined && exp.longitude !== null
        ? `${exp.latitude}, ${exp.longitude}`
        : '';
    const mapsLink =
      exp.latitude !== undefined && exp.latitude !== null && exp.longitude !== undefined && exp.longitude !== null
        ? `https://www.google.com/maps?q=${exp.latitude},${exp.longitude}`
        : '';
    const notes = (exp.notes || '').replace(/"/g, '""');
    const dateFormatted = formatDate(exp.expense_date, 'dd/MM/yyyy');

    csvContent += `"${dateFormatted}";"${exp.title.replace(/"/g, '""')}";"${category}";"${formatNumber(exp.amount)}";"${exp.currency}";"${rateStr}";"${formatNumber(converted)}";"${payers}";"${participants}";"${location}";"${coordsStr}";"${mapsLink}";"${notes}"\n`;
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
  const avgPerPerson = balances.length > 0 ? totalAmount / balances.length : 0;

  // =========================================================================
  // PÁGINA 1: Cabecera, KPIs, Gráfica Temporal y Gráfica por Categorías
  // =========================================================================

  // 1. Header Banner
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pachas: ${cleanPdfText(group.name)}`, 14, 18);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Informe de Gastos, Gráficas y Liquidaciones | Moneda Base: ${baseCurrency} | Generado el ${formatDate(new Date().toISOString(), 'dd/MM/yyyy')}`,
    14,
    28
  );

  // 2. KPI Summary Cards (4 boxes)
  const cardY = 42;
  const cardW = 42.5;
  const cardH = 18;
  const cardGap = 4;
  const kpis = [
    { label: 'TOTAL GASTADO', val: formatMoney(totalAmount, baseCurrency), color: [16, 185, 129] },
    { label: 'MEDIA / AMIGO', val: formatMoney(avgPerPerson, baseCurrency), color: [15, 23, 42] },
    { label: 'Nº DE GASTOS', val: `${expenses.length} gastos`, color: [15, 23, 42] },
    { label: 'TRANSFERENCIAS', val: `${debts.length} pagos`, color: [245, 158, 11] },
  ];

  kpis.forEach((kpi, i) => {
    const x = 14 + i * (cardW + cardGap);
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.3);
    doc.roundedRect(x, cardY, cardW, cardH, 2.5, 2.5, 'FD');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(kpi.label, x + 3, cardY + 5.5);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, x + 3, cardY + 13.5);
  });

  // 3. Gráfica 1: Evolución Temporal de Gastos (Gráfico de Barras por Día)
  let currentY = cardY + cardH + 8;
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Evolución Temporal de Gastos por Día', 14, currentY);

  currentY += 4;
  const chartBoxX = 14;
  const chartBoxY = currentY;
  const chartBoxW = 182;
  const chartBoxH = 68;

  // Background frame
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(chartBoxX, chartBoxY, chartBoxW, chartBoxH, 3, 3, 'FD');

  // Compute daily spending buckets
  const dayBucketsMap = new Map<string, { label: string; date: string; total: number }>();
  const sortedExpenses = [...expenses].sort(
    (a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime()
  );

  sortedExpenses.forEach((exp) => {
    const key = formatDate(exp.expense_date, 'yyyy-MM-dd');
    const label = formatDate(exp.expense_date, 'd MMM');
    const amt = getConvertedAmount(exp, baseCurrency);

    if (!dayBucketsMap.has(key)) {
      dayBucketsMap.set(key, { label, date: key, total: 0 });
    }
    dayBucketsMap.get(key)!.total += amt;
  });

  const dayBuckets = Array.from(dayBucketsMap.values());
  const maxDayTotal = Math.max(...dayBuckets.map((d) => d.total), 1);
  const chartScaleMax = maxDayTotal * 1.15;

  // Gridlines & Y-axis labels
  const plotX = chartBoxX + 18;
  const plotY = chartBoxY + 8;
  const plotW = chartBoxW - 24;
  const plotH = chartBoxH - 22;

  doc.setDrawColor(241, 245, 249); // Slate 100
  doc.setLineWidth(0.2);
  for (let i = 0; i <= 3; i++) {
    const gy = plotY + (plotH / 3) * i;
    const gval = chartScaleMax * (1 - i / 3);
    doc.line(plotX, gy, plotX + plotW, gy);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(formatMoney(gval, baseCurrency), chartBoxX + 2, gy + 1);
  }

  // Draw Bars
  if (dayBuckets.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('No hay gastos registrados en este periodo', chartBoxX + chartBoxW / 2, chartBoxY + chartBoxH / 2, { align: 'center' });
  } else {
    const barWidth = Math.min(plotW / (dayBuckets.length * 1.6), 18);
    const totalBarsWidth = dayBuckets.length * barWidth;
    const spacing = (plotW - totalBarsWidth) / (dayBuckets.length + 1);

    dayBuckets.forEach((bucket, idx) => {
      const bx = plotX + spacing + idx * (barWidth + spacing);
      const bh = Math.max((bucket.total / chartScaleMax) * plotH, 2);
      const by = plotY + plotH - bh;

      // Bar fill (Emerald gradient tone)
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(bx, by, barWidth, bh, 1, 1, 'F');

      // Amount above bar
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(formatMoney(bucket.total, baseCurrency), bx + barWidth / 2, by - 1.5, { align: 'center' });

      // Date label below bar
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(bucket.label, bx + barWidth / 2, plotY + plotH + 5, { align: 'center' });
    });
  }

  // 4. Gráfica 2: Distribución por Categorías
  currentY = chartBoxY + chartBoxH + 8;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Distribución de Gastos por Categoría', 14, currentY);

  currentY += 4;
  const catBoxX = 14;
  const catBoxY = currentY;
  const catBoxW = 182;
  const catBoxH = 72;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(catBoxX, catBoxY, catBoxW, catBoxH, 3, 3, 'FD');

  // Compute category totals
  const catTotalsMap: Record<string, number> = {};
  expenses.forEach((e) => {
    const amt = getConvertedAmount(e, baseCurrency);
    catTotalsMap[e.category] = (catTotalsMap[e.category] || 0) + amt;
  });

  const catEntries = Object.entries(catTotalsMap).sort((a, b) => b[1] - a[1]);
  const catColors: [number, number, number][] = [
    [16, 185, 129], // Emerald
    [14, 165, 233], // Sky
    [168, 85, 247], // Purple
    [245, 158, 11], // Amber
    [244, 63, 94],  // Rose
    [20, 184, 166], // Teal
  ];

  if (catEntries.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('No hay categorías registradas', catBoxX + catBoxW / 2, catBoxY + catBoxH / 2, { align: 'center' });
  } else {
    const maxItems = Math.min(catEntries.length, 5);
    const rowH = 11.5;

    catEntries.slice(0, maxItems).forEach(([catKey, catAmt], idx) => {
      const cy = catBoxY + 7 + idx * rowH;
      const catInfo = getCategoryInfo(catKey as any);
      const pct = totalAmount > 0 ? (catAmt / totalAmount) * 100 : 0;
      const color = catColors[idx % catColors.length];

      // Category Name
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`${catInfo.label}`, catBoxX + 6, cy + 2.5);

      // Amount & %
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      const amtStr = `${formatMoney(catAmt, baseCurrency)} (${pct.toFixed(1)}%)`;
      doc.text(amtStr, catBoxX + catBoxW - 6, cy + 2.5, { align: 'right' });

      // Progress bar background
      const barTrackX = catBoxX + 6;
      const barTrackY = cy + 4.5;
      const barTrackW = catBoxW - 12;
      const barTrackH = 3;

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(barTrackX, barTrackY, barTrackW, barTrackH, 1.5, 1.5, 'F');

      // Filled portion
      const fillW = Math.max((pct / 100) * barTrackW, 2);
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(barTrackX, barTrackY, fillW, barTrackH, 1.5, 1.5, 'F');
    });
  }

  // =========================================================================
  // PÁGINA 2: Comparativa por Amigo, Tabla de Saldos y Propuesta de Liquidación
  // =========================================================================
  doc.addPage();

  // Page 2 Header Banner
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, 210, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pachas: ${group.name} — Saldos y Liquidaciones`, 14, 13);

  // 1. Gráfica 3: Comparativa por Amigo (Pagado vs Consumido)
  currentY = 28;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Comparativa por Amigo: Total Pagado vs Consumido', 14, currentY);

  currentY += 4;
  const memBoxX = 14;
  const memBoxY = currentY;
  const memBoxW = 182;
  const maxBalanceAmt = Math.max(...balances.map((b) => Math.max(b.total_paid, b.total_owed)), 1);
  const memRowsCount = Math.min(balances.length, 6);
  const memRowH = 11;
  const memBoxH = 10 + memRowsCount * memRowH;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(memBoxX, memBoxY, memBoxW, memBoxH, 3, 3, 'FD');

  // Legend at top of member chart
  doc.setFillColor(16, 185, 129);
  doc.rect(memBoxX + 6, memBoxY + 4, 3, 3, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Pagado (Adelantado)', memBoxX + 11, memBoxY + 6.5);

  doc.setFillColor(14, 165, 233);
  doc.rect(memBoxX + 50, memBoxY + 4, 3, 3, 'F');
  doc.text('Consumido (Reparto)', memBoxX + 55, memBoxY + 6.5);

  balances.slice(0, 6).forEach((b, idx) => {
    const ry = memBoxY + 11 + idx * memRowH;
    const name = cleanPdfText(b.profile.full_name || 'Amigo');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(name, memBoxX + 6, ry + 3);

    // Paid Bar (Emerald)
    const barStartX = memBoxX + 45;
    const maxBarW = 85;
    const paidW = Math.max((b.total_paid / maxBalanceAmt) * maxBarW, 1);
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(barStartX, ry, paidW, 2.5, 1, 1, 'F');

    // Owed Bar (Sky)
    const owedW = Math.max((b.total_owed / maxBalanceAmt) * maxBarW, 1);
    doc.setFillColor(14, 165, 233);
    doc.roundedRect(barStartX, ry + 3.2, owedW, 2.5, 1, 1, 'F');

    // Values text
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const netSign = b.net_balance >= 0 ? '+' : '';
    const netText = `Saldo: ${netSign}${formatMoney(b.net_balance, baseCurrency)}`;
    doc.text(netText, memBoxX + memBoxW - 6, ry + 4, { align: 'right' });
  });

  // 2. Balances Table
  currentY = memBoxY + memBoxH + 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`4. Tabla de Saldos y Balances (en ${baseCurrency})`, 14, currentY);

  const balancesData = balances.map((b) => [
    cleanPdfText(b.profile.full_name || 'Amigo'),
    formatMoney(b.total_paid, baseCurrency),
    formatMoney(b.total_owed, baseCurrency),
    (b.net_balance >= 0 ? '+' : '') + formatMoney(b.net_balance, baseCurrency),
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: [[
      'Participante',
      `Total Pagado (${baseCurrency})`,
      `Total Consumido (${baseCurrency})`,
      `Saldo Neto (${baseCurrency})`
    ]],
    body: balancesData,
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2.8 },
  });

  // 3. Simplified Debts Table
  currentY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`5. Propuesta de Liquidación (Transferencias sugeridas)`, 14, currentY);

  const debtsData =
    debts.length > 0
      ? debts.map((d) => [
          cleanPdfText(d.from_profile.full_name || 'Amigo'),
          'Paga a',
          cleanPdfText(d.to_profile.full_name || 'Amigo'),
          formatMoney(d.amount, baseCurrency),
          d.to_profile.bizum_phone ? `Bizum: ${d.to_profile.bizum_phone}` : 'Efectivo / Transferencia',
        ])
      : [['Todo el mundo está en paz', '-', '-', formatMoney(0, baseCurrency), 'Sin deudas pendientes']];

  autoTable(doc, {
    startY: currentY + 3,
    head: [['Deudor', 'Acción', 'Beneficiario', `Importe (${baseCurrency})`, 'Método Sugerido']],
    body: debtsData,
    theme: 'striped',
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2.8 },
  });

  // =========================================================================
  // PÁGINA 3: Desglose General de Todos los Gastos
  // =========================================================================
  doc.addPage();
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, 210, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pachas: ${group.name} — Historial General de Gastos`, 14, 13);

  const allExpensesData = expenses.map((e) => {
    const cat = getCategoryInfo(e.category);
    const payerStr = e.payers?.map((p) => cleanPdfText(p.profile?.full_name)).join(', ') || 'N/A';
    const converted = getConvertedAmount(e, baseCurrency);
    const isForeign = e.currency !== baseCurrency;

    const originalAmountStr = formatMoney(e.amount, e.currency);
    const convertedAmountStr = formatMoney(converted, baseCurrency);

    return [
      formatDate(e.expense_date, 'dd/MM/yyyy'),
      cleanPdfText(e.title),
      cleanPdfText(cat.label),
      payerStr,
      isForeign ? originalAmountStr : '-',
      convertedAmountStr,
    ];
  });

  autoTable(doc, {
    startY: 26,
    head: [[
      'Fecha',
      'Concepto',
      'Categoría',
      'Pagado Por',
      'Importe Original',
      `Importe (${baseCurrency})`
    ]],
    body: allExpensesData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
  });

  // =========================================================================
  // PÁGINA 4 en adelante: Desglose Individual de Gastos por Participante
  // =========================================================================
  doc.addPage();
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, 210, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pachas: ${cleanPdfText(group.name)} — Desglose Individual por Amigo`, 14, 13);

  let memberCurrentY = 28;

  balances.forEach((balance, memberIdx) => {
    const memberId = balance.user_id;
    const rawMemberName = balance.profile.full_name || 'Amigo';
    const memberName = cleanPdfText(rawMemberName);

    // Find all expenses this member either paid for or participated in
    const memberExpenses = sortedExpenses.filter((exp) => {
      const hasPaid = exp.payers && exp.payers.length > 0
        ? exp.payers.some((p) => p.user_id === memberId && p.amount_paid > 0)
        : exp.created_by === memberId;

      const hasParticipated = exp.participants && exp.participants.length > 0
        ? exp.participants.some((pt) => pt.user_id === memberId && pt.amount_owed > 0)
        : true; // shared equally if not specified

      return hasPaid || hasParticipated;
    });

    // Check if we need a page break before starting a new member block
    if (memberCurrentY > 230) {
      doc.addPage();
      memberCurrentY = 20;
    }

    // Member Section Header Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.setLineWidth(0.3);
    doc.roundedRect(14, memberCurrentY, 182, 14, 2, 2, 'FD');

    // Vector bullet
    doc.setFillColor(16, 185, 129);
    doc.circle(18, memberCurrentY + 5.5, 1.5, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(memberName, 22, memberCurrentY + 6.8);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const netSign = balance.net_balance >= 0 ? '+' : '';
    const summaryLine = `Total Pagado: ${formatMoney(balance.total_paid, baseCurrency)}   |   Total Consumido: ${formatMoney(balance.total_owed, baseCurrency)}   |   Saldo Neto: ${netSign}${formatMoney(balance.net_balance, baseCurrency)}`;
    doc.text(summaryLine, 18, memberCurrentY + 11);

    // Build rows for member's expenses
    const memberRows = memberExpenses.map((exp) => {
      const cat = getCategoryInfo(exp.category);
      const convertedTotal = getConvertedAmount(exp, baseCurrency);

      // How much did this member pay?
      let paidByMember = 0;
      if (exp.payers && exp.payers.length > 0) {
        const payerObj = exp.payers.find((p) => p.user_id === memberId);
        if (payerObj) {
          paidByMember = exp.amount > 0 ? (payerObj.amount_paid / exp.amount) * convertedTotal : payerObj.amount_paid;
        }
      } else if (exp.created_by === memberId) {
        paidByMember = convertedTotal;
      }

      // How much did this member consume?
      let owedByMember = 0;
      if (exp.participants && exp.participants.length > 0) {
        const partObj = exp.participants.find((pt) => pt.user_id === memberId);
        if (partObj) {
          owedByMember = partObj.amount_owed;
        }
      } else {
        owedByMember = balances.length > 0 ? convertedTotal / balances.length : convertedTotal;
      }

      return [
        formatDate(exp.expense_date, 'dd/MM/yyyy'),
        cleanPdfText(exp.title),
        cleanPdfText(cat.label),
        formatMoney(convertedTotal, baseCurrency),
        paidByMember > 0 ? formatMoney(paidByMember, baseCurrency) : '-',
        owedByMember > 0 ? formatMoney(owedByMember, baseCurrency) : '-',
      ];
    });

    if (memberRows.length === 0) {
      memberRows.push(['-', 'Sin gastos asociados a este participante', '-', '-', '-', '-']);
    }

    autoTable(doc, {
      startY: memberCurrentY + 17,
      head: [[
        'Fecha',
        'Concepto',
        'Categoría',
        `Total Gasto (${baseCurrency})`,
        `Pagó ${memberName.split(' ')[0]}`,
        `Consumo de ${memberName.split(' ')[0]}`,
      ]],
      body: memberRows,
      foot: [[
        'TOTALES',
        '',
        '',
        '',
        formatMoney(balance.total_paid, baseCurrency),
        formatMoney(balance.total_owed, baseCurrency),
      ]],
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5 },
      styles: { fontSize: 7.5, cellPadding: 2.2 },
    });

    memberCurrentY = (doc as any).lastAutoTable.finalY + 10;
  });

  // Save the complete PDF
  doc.save(`Pachas_${group.name.replace(/\s+/g, '_')}_informe_completo.pdf`);
}

/**
 * Exports group geolocated expenses to standard KML format for Google Earth / Google My Maps.
 * Strictly contains ONLY the trip's establishments with their titles, amounts, and coordinates.
 */
export function exportGroupLocationsToKML(group: Group, expenses: Expense[]) {
  const geoExpenses = expenses.filter(
    (e) => typeof e.latitude === 'number' && typeof e.longitude === 'number'
  );

  if (geoExpenses.length === 0) return;

  let kml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  kml += `<kml xmlns="http://www.opengis.net/kml/2.2">\n`;
  kml += `  <Document>\n`;
  kml += `    <name>${group.name.replace(/&/g, '&amp;')} - Sitios y Gastos</name>\n`;
  kml += `    <description>Mapa de establecimientos registrados en Pachas para ${group.name.replace(/&/g, '&amp;')}</description>\n`;

  geoExpenses.forEach((exp, idx) => {
    const title = (exp.location_name || exp.title).replace(/&/g, '&amp;');
    const payer = exp.payers?.[0]?.profile?.full_name || exp.creator?.full_name || 'Amigo';
    const desc = `Gasto: ${exp.title.replace(/&/g, '&amp;')}\nImporte: ${exp.amount} ${exp.currency}\nFecha: ${formatDate(exp.expense_date, 'dd/MM/yyyy HH:mm')}\nPagador: ${payer}\nParada: #${idx + 1}`.replace(/&/g, '&amp;');

    kml += `    <Placemark>\n`;
    kml += `      <name>#${idx + 1} - ${title}</name>\n`;
    kml += `      <description>${desc}</description>\n`;
    kml += `      <Point>\n`;
    kml += `        <coordinates>${exp.longitude},${exp.latitude},0</coordinates>\n`;
    kml += `      </Point>\n`;
    kml += `    </Placemark>\n`;
  });

  kml += `  </Document>\n`;
  kml += `</kml>`;

  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Pachas_${group.name.replace(/\s+/g, '_')}_sitios.kml`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
