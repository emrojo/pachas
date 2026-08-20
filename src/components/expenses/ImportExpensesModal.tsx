'use client';

import React, { useState } from 'react';
import { usePachas, CreateExpenseInput } from '@/context/PachasContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getCategoryInfo } from '@/lib/categories';
import { parseEuropeanAmount, getCurrencyByCode } from '@/lib/currencies';
import { ExpenseCategory } from '@/types/database';
import confetti from 'canvas-confetti';
import {
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
  FileText,
  FileDown,
  Sparkles,
  AlertOctagon,
  AlertCircle,
  Info,
  HelpCircle,
} from 'lucide-react';

export interface ImportExpensesModalProps {
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ParsedRow {
  id: string;
  valid: boolean;
  errors: string[];
  raw: {
    title: string;
    amount: string;
    currency: string;
    date: string;
    category: ExpenseCategory;
    payer: string;
    participantsStr: string;
    participantsCount: string;
    notes: string;
  };
  expenseInput?: CreateExpenseInput;
}

export const ImportExpensesModal: React.FC<ImportExpensesModalProps> = ({
  groupId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { getGroup, getGroupMembers, currentUser, importExpenses } = usePachas();

  const group = getGroup(groupId);
  const members = getGroupMembers(groupId);
  const baseCurrency = group?.base_currency || 'EUR';

  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrorMessage, setImportErrorMessage] = useState('');
  const [selectedErrorRow, setSelectedErrorRow] = useState<ParsedRow | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'preview'>('upload');

  // Normalize category string from CSV to valid ExpenseCategory
  const mapCategory = (catStr?: string): ExpenseCategory => {
    if (!catStr) return 'food';
    const lower = catStr.toLowerCase().trim();
    if (lower.includes('comid') || lower.includes('restauran') || lower.includes('food') || lower.includes('cena') || lower.includes('almuerz')) return 'food';
    if (lower.includes('alojam') || lower.includes('hotel') || lower.includes('airbn') || lower.includes('accomm')) return 'accommodation';
    if (lower.includes('transp') || lower.includes('vuelo') || lower.includes('gasolin') || lower.includes('taxi') || lower.includes('tren') || lower.includes('coche')) return 'transport';
    if (lower.includes('activ') || lower.includes('ocio') || lower.includes('museo') || lower.includes('tour') || lower.includes('excurs')) return 'activities';
    if (lower.includes('compr') || lower.includes('super') || lower.includes('shop') || lower.includes('mercad')) return 'shopping';
    return 'other';
  };

  // Normalize date string (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD) to ISO YYYY-MM-DD
  const mapDate = (dateStr?: string): string => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const cleaned = dateStr.trim();
    // Match DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    // Match YYYY-MM-DD
    const ymdMatch = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return new Date().toISOString().split('T')[0];
  };

  // Helper to detect keywords that mean all members of the group
  const isAllMembersKeyword = (val?: string): boolean => {
    if (!val) return false;
    const clean = val.trim().toLowerCase();
    return (
      clean === 'todos' ||
      clean === 'todas' ||
      clean === 'all' ||
      clean === 'todos los miembros' ||
      clean === 'todo el grupo' ||
      clean === 'todos los participantes' ||
      clean === 'grupo' ||
      clean === '*'
    );
  };

  // Strict check for member in the group
  const findMember = (nameOrEmail?: string): { memberId: string | null; error?: string } => {
    if (!nameOrEmail || !nameOrEmail.trim()) {
      return { memberId: currentUser.id };
    }
    if (isAllMembersKeyword(nameOrEmail)) {
      return { memberId: currentUser.id };
    }
    const q = nameOrEmail.trim().toLowerCase();
    const found = members.find(
      (m) =>
        m.profile?.full_name?.toLowerCase() === q ||
        m.profile?.full_name?.toLowerCase().includes(q) ||
        m.profile?.email?.toLowerCase() === q ||
        m.user_id.toLowerCase() === q
    );
    if (!found) {
      return {
        memberId: null,
        error: `El usuario "${nameOrEmail.trim()}" no está registrado en el grupo "${group?.name || ''}".`,
      };
    }
    return { memberId: found.user_id };
  };

  // Parse multi-payer and single-payer formats
  const parsePayers = (
    rawPayerStr: string,
    totalAmount: number
  ): { payers: { userId: string; amountPaid: number }[]; error?: string } => {
    const trimmed = rawPayerStr.trim();
    if (!trimmed || isAllMembersKeyword(trimmed)) {
      return { payers: [{ userId: currentUser.id, amountPaid: totalAmount }] };
    }

    // Check if string contains colons, parentheses or equal signs with amounts: e.g. "Eduardo: 350 + Carlos: 250"
    const hasColons = trimmed.includes(':');
    const hasParentheses = /\([^)]*\d+[^)]*\)/.test(trimmed);
    const hasEquals = /=[0-9]/.test(trimmed);

    if (hasColons || hasParentheses || hasEquals) {
      // Split by '+', '|', '/', '&', ' y ', or ';' or comma followed by a word character
      const segments = trimmed
        .split(/\s*(?:\+|\/|\||&|\by\b|\band\b|;|(?:,\s*(?=[A-Za-zÀ-ÿ])))\s*/)
        .map((s) => s.trim())
        .filter(Boolean);

      const payers: { userId: string; amountPaid: number }[] = [];
      let sumPaid = 0;

      for (const segment of segments) {
        let name = '';
        let amountPart = 0;

        if (segment.includes(':')) {
          const parts = segment.split(':');
          name = parts[0].trim();
          amountPart = parseEuropeanAmount(parts.slice(1).join(':'));
        } else if (/\(([^)]+)\)/.test(segment)) {
          const match = segment.match(/^(.*?)\(([^)]+)\)$/);
          if (match) {
            name = match[1].trim();
            amountPart = parseEuropeanAmount(match[2]);
          }
        } else if (segment.includes('=')) {
          const parts = segment.split('=');
          name = parts[0].trim();
          amountPart = parseEuropeanAmount(parts.slice(1).join('='));
        } else {
          name = segment;
        }

        const memRes = findMember(name);
        if (memRes.error) {
          return { payers: [], error: memRes.error };
        }

        if (amountPart <= 0) {
          return {
            payers: [],
            error: `No se pudo determinar el importe pagado por "${name}" en "${segment}". Formato esperado: "Nombre: Importe" (ej: Eduardo: 350).`,
          };
        }

        payers.push({ userId: memRes.memberId!, amountPaid: amountPart });
        sumPaid += amountPart;
      }

      // Validate total sum matches expense amount (with small rounding margin)
      if (Math.abs(sumPaid - totalAmount) > 0.05) {
        return {
          payers: [],
          error: `La suma de las cantidades pagadas (${sumPaid.toFixed(2).replace('.', ',')}) no coincide con el importe total del gasto (${totalAmount.toFixed(2).replace('.', ',')}).`,
        };
      }

      return { payers };
    }

    // Format: Multiple names without specific amounts, e.g. "Eduardo + Carlos" or "Eduardo, Carlos" (equal split of the payment)
    const multiNames = trimmed
      .split(/\s*(?:\+|\/|\||&|\by\b|\band\b|;|,)\s*/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (multiNames.length > 1) {
      const payers: { userId: string; amountPaid: number }[] = [];
      const equalShare = Math.round((totalAmount / multiNames.length) * 100) / 100;
      let accumulated = 0;

      for (let i = 0; i < multiNames.length; i++) {
        const pName = multiNames[i];
        const memRes = findMember(pName);
        if (memRes.error) {
          return { payers: [], error: memRes.error };
        }
        const paid = i === multiNames.length - 1 ? Math.round((totalAmount - accumulated) * 100) / 100 : equalShare;
        accumulated += paid;
        payers.push({ userId: memRes.memberId!, amountPaid: paid });
      }
      return { payers };
    }

    // Format: Single payer name
    const singleRes = findMember(trimmed);
    if (singleRes.error) {
      return { payers: [], error: singleRes.error };
    }
    return { payers: [{ userId: singleRes.memberId!, amountPaid: totalAmount }] };
  };

  // Parse CSV text
  const parseCSVContent = (content: string) => {
    setIsProcessing(true);
    setImportErrorMessage('');
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      setParsedRows([]);
      setIsProcessing(false);
      return;
    }

    // Detect separator (; or , or \t)
    const firstLine = lines[0];
    let separator = ';';
    if (firstLine.includes(';') && !firstLine.includes('\t')) {
      separator = ';';
    } else if (firstLine.includes('\t')) {
      separator = '\t';
    } else if (firstLine.includes(',')) {
      separator = ',';
    }

    // Parse header row
    const rawHeaders = lines[0].split(separator).map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
    
    // Map header column indexes
    const colIndex = {
      date: rawHeaders.findIndex((h) => h.includes('fecha') || h.includes('date')),
      title: rawHeaders.findIndex((h) => h.includes('concepto') || h.includes('título') || h.includes('titulo') || h.includes('title') || h.includes('descrip')),
      category: rawHeaders.findIndex((h) => h.includes('categor') || h.includes('tipo')),
      amount: rawHeaders.findIndex((h) => h.includes('importe') || h.includes('cantidad') || h.includes('total') || h.includes('amount') || h.includes('precio')),
      currency: rawHeaders.findIndex((h) => h.includes('divisa') || h.includes('moneda') || h.includes('currency')),
      payer: rawHeaders.findIndex((h) => h.includes('pagado') || h.includes('pagó') || h.includes('pago') || h.includes('payer') || h.includes('quien')),
      participants: rawHeaders.findIndex((h) => h.includes('repartir') || h.includes('participante') || h.includes('amigos') || h.includes('split')),
      notes: rawHeaders.findIndex((h) => h.includes('nota') || h.includes('comentario') || h.includes('note')),
    };

    // If no header matched title or amount, fallback by standard column sequence
    if (colIndex.title === -1 && colIndex.amount === -1) {
      colIndex.date = 0;
      colIndex.title = 1;
      colIndex.category = 2;
      colIndex.amount = 3;
      colIndex.currency = 4;
      colIndex.payer = 5;
      colIndex.participants = 6;
      colIndex.notes = 7;
    }

    const startIndex = (colIndex.title !== -1 || colIndex.amount !== -1) ? 1 : 0;
    const parsed: ParsedRow[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(separator).map((c) => c.replace(/^["']|["']$/g, '').trim());
      const rawTitle = cols[colIndex.title >= 0 ? colIndex.title : 1] || '';
      const rawAmountStr = cols[colIndex.amount >= 0 ? colIndex.amount : 3] || '0';
      const rawCategory = cols[colIndex.category >= 0 ? colIndex.category : 2] || 'food';
      const rawDate = cols[colIndex.date >= 0 ? colIndex.date : 0] || '';
      const rawCurrency = cols[colIndex.currency >= 0 ? colIndex.currency : 4] || baseCurrency;
      const rawPayer = cols[colIndex.payer >= 0 ? colIndex.payer : 5] || '';
      const rawParticipants = cols[colIndex.participants >= 0 ? colIndex.participants : 6] || '';
      const rawNotes = cols[colIndex.notes >= 0 ? colIndex.notes : 7] || '';

      const amount = parseEuropeanAmount(rawAmountStr);
      const errors: string[] = [];

      // Validate Title & Amount
      if (!rawTitle.trim()) {
        errors.push('Falta el concepto o título del gasto.');
      }
      if (amount <= 0) {
        errors.push(`El importe "${rawAmountStr}" no es válido o debe ser mayor que 0.`);
      }

      // Currency & Exchange rate
      const currencyObj = getCurrencyByCode(rawCurrency || baseCurrency);
      const currency = currencyObj.code;
      const baseObj = getCurrencyByCode(baseCurrency);
      const exchangeRate = currencyObj.rateToEur / baseObj.rateToEur;

      // Strict validation for Payer(s)
      const payerResult = parsePayers(rawPayer, amount);
      let payersList: { userId: string; amountPaid: number }[] = [{ userId: currentUser.id, amountPaid: amount }];
      if (payerResult.error) {
        errors.push(payerResult.error);
      } else if (payerResult.payers && payerResult.payers.length > 0) {
        payersList = payerResult.payers;
      }

      // Strict validation for Participants
      let participantIds = members.map((m) => m.user_id);
      const cleanParticipants = rawParticipants.trim();

      if (cleanParticipants && !isAllMembersKeyword(cleanParticipants)) {
        const pNames = cleanParticipants.split(/[,;\/]/).map((n) => n.trim()).filter(Boolean);
        const resolvedIds = new Set<string>();

        for (const pName of pNames) {
          if (isAllMembersKeyword(pName)) {
            members.forEach((m) => resolvedIds.add(m.user_id));
            continue;
          }
          const res = findMember(pName);
          if (res.error) {
            errors.push(res.error);
          } else if (res.memberId) {
            resolvedIds.add(res.memberId);
          }
        }

        if (resolvedIds.size > 0 && errors.length === 0) {
          participantIds = Array.from(resolvedIds);
        }
      }

      const isValid = errors.length === 0;

      const expenseInput: CreateExpenseInput | undefined = isValid
        ? {
            groupId,
            title: rawTitle,
            amount,
            currency,
            exchangeRate,
            category: mapCategory(rawCategory),
            expenseDate: mapDate(rawDate),
            notes: rawNotes || undefined,
            splitType: 'EQUAL',
            payers: payersList,
            selectedParticipantIds: participantIds,
          }
        : undefined;

      parsed.push({
        id: `row-${i}`,
        valid: isValid,
        errors,
        raw: {
          title: rawTitle,
          amount: rawAmountStr,
          currency,
          date: mapDate(rawDate),
          category: mapCategory(rawCategory),
          payer: rawPayer || (members.find((m) => m.user_id === payersList[0]?.userId)?.profile?.full_name || 'Tú'),
          participantsStr: rawParticipants,
          participantsCount: isValid ? `${participantIds.length} amigos` : 'Error',
          notes: rawNotes,
        },
        expenseInput,
      });
    }

    setParsedRows(parsed);
    setIsProcessing(false);
    setActiveTab('preview');
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setRawText(text);
        parseCSVContent(text);
      };
      reader.readAsText(file);
    }
  };

  // Download Sample Template CSV with valid group members
  const handleDownloadTemplate = () => {
    const memberNames = members.map((m) => m.profile?.full_name?.split(' ')[0] || 'Amigo');
    const defaultPayer = memberNames[0] || 'Eduardo';
    const otherPayer = memberNames[1] || defaultPayer;
    const splitSample = memberNames.slice(0, 2).join(', ');

    let sampleCSV = 'data:text/csv;charset=utf-8,\uFEFF';
    sampleCSV += 'Fecha;Concepto;Categoría;Importe;Divisa;Pagado Por;Repartir Entre;Notas\n';
    sampleCSV += `15/08/2026;Cena pizzería;food;68,50;EUR;${defaultPayer};Todos;Pizzas y bebidas varias\n`;
    sampleCSV += `16/08/2026;Gasolina autopista;transport;60,00;EUR;${defaultPayer} + ${otherPayer};Todos;Gasolina pagada a medias (30€ c/u)\n`;
    sampleCSV += `17/08/2026;Entradas museo;activities;30,00;EUR;${defaultPayer};${splitSample};Visita cultural guiada\n`;
    sampleCSV += `18/08/2026;Supermercado compras;shopping;82,20;EUR;${defaultPayer};Todos;Desayunos y snacks\n`;
    sampleCSV += `19/08/2026;Villa Vacaciones;accommodation;600,00;EUR;${defaultPayer}: 350 + ${otherPayer}: 250;Todos;Alquiler villa con pagos desglosados\n`;

    const encodedUri = encodeURI(sampleCSV);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Plantilla_Gastos_${group?.name?.replace(/\s+/g, '_') || 'Pachas'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete a parsed row from preview list
  const handleDeleteRow = (id: string) => {
    const updated = parsedRows.filter((r) => r.id !== id);
    setParsedRows(updated);
    if (updated.every((r) => r.valid)) {
      setImportErrorMessage('');
    }
  };

  // Confirm import with strict failure protection
  const handleConfirmImport = async () => {
    const invalidRows = parsedRows.filter((r) => !r.valid);
    if (invalidRows.length > 0) {
      setImportErrorMessage(
        `❌ Importación bloqueada: Hay ${invalidRows.length} fila(s) con errores o usuarios no registrados en el grupo. Corrige los datos o elimina las filas erróneas antes de continuar.`
      );
      return;
    }

    const validInputs = parsedRows
      .filter((r) => r.valid && r.expenseInput)
      .map((r) => r.expenseInput as CreateExpenseInput);

    if (validInputs.length === 0) {
      setImportErrorMessage('No hay gastos válidos para importar.');
      return;
    }

    try {
      setIsImporting(true);
      setImportErrorMessage('');
      await importExpenses(groupId, validInputs);

      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10b981', '#059669', '#34d399', '#6ee7b7', '#f59e0b'],
      });

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error importing expenses:', err);
      setImportErrorMessage(err.message || 'Error al importar los gastos.');
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.valid).length;
  const errorCount = parsedRows.filter((r) => !r.valid).length;
  const hasErrors = errorCount > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Importar Gastos desde Excel / CSV"
      description={`Grupo: ${group?.name || ''} (${members.length} miembros registrados)`}
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Subir Archivo
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'paste'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Pegar Tabla / Texto
          </button>

          {parsedRows.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Vista Previa ({parsedRows.length})
            </button>
          )}
        </div>

        {/* Tab 1: Subir Archivo */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-6 text-center hover:border-emerald-500 transition-colors bg-slate-50/50 dark:bg-slate-900/50">
              <UploadCloud className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Arrastra tu archivo CSV o Excel aquí
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">
                Soporta archivos exportados de Excel, Google Sheets o bancos (.csv, .txt) con separador de comas o punto y coma.
              </p>

              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer shadow-xs transition-colors">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Seleccionar archivo CSV</span>
                <input
                  type="file"
                  accept=".csv, .txt, .tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Formats help guide banner */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                💡 Formatos soportados en la columna &quot;Pagado Por&quot;:
              </span>
              <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 pl-3 list-disc">
                <li><strong>Un solo pagador:</strong> <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">Eduardo</code> (paga el 100%).</li>
                <li><strong>Varios con importes exactos:</strong> <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">Eduardo: 350 + Carlos: 250</code></li>
                <li><strong>Varios a partes iguales:</strong> <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">Eduardo + Carlos</code> o <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">Eduardo, Carlos</code> (50% cada uno).</li>
                <li><strong>Repartir entre:</strong> Usa <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">Todos</code> o deja la celda vacía para que se divida entre todos los amigos del grupo.</li>
              </ul>
            </div>

            {/* Template Download Banner */}
            <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <FileDown className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                    Plantilla personalizada con miembros del grupo
                  </span>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Descarga el CSV con los nombres exactos de los miembros actuales para evitar errores.
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadTemplate}
                className="gap-1 text-xs shrink-0 bg-white dark:bg-slate-900"
              >
                <Download className="w-3.5 h-3.5" />
                Plantilla CSV
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2: Pegar Texto Directo */}
        {activeTab === 'paste' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Copia las celdas de tu hoja de cálculo (Excel, Numbers o Google Sheets) y pégalas en el cuadro siguiente:
            </p>
            <textarea
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Fecha;Concepto;Categoría;Importe;Divisa;Pagado Por&#10;15/08/2026;Cena;food;45,50;EUR;Eduardo"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="brand"
                disabled={!rawText.trim()}
                onClick={() => parseCSVContent(rawText)}
              >
                Analizar y Procesar Tabla
              </Button>
            </div>
          </div>
        )}

        {/* Tab 3: Vista Previa y Confirmación */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge variant="emerald" size="sm">
                  {validCount} válidos
                </Badge>
                {hasErrors && (
                  <Badge variant="rose" size="sm">
                    {errorCount} con errores (bloqueante)
                  </Badge>
                )}
              </div>

              <span className="text-[11px] text-slate-400">
                Miembros registrados: {members.map((m) => m.profile?.full_name?.split(' ')[0]).join(', ')}
              </span>
            </div>

            {/* Error summary banner if any error exists */}
            {hasErrors && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl text-xs text-rose-700 dark:text-rose-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>No se permite importar mientras existan filas con errores</span>
                </div>
                <p className="text-[11px] text-rose-600/90 dark:text-rose-400">
                  Se han detectado usuarios no registrados en el grupo o datos incompletos. Elimina las filas erróneas usando el botón de papelera para poder realizar la importación.
                </p>
              </div>
            )}

            {importErrorMessage && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2 font-semibold">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{importErrorMessage}</span>
              </div>
            )}

            {/* Table Preview */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold sticky top-0">
                  <tr>
                    <th className="p-2.5">Estado</th>
                    <th className="p-2.5">Fecha</th>
                    <th className="p-2.5">Concepto</th>
                    <th className="p-2.5">Importe</th>
                    <th className="p-2.5">Pagado por</th>
                    <th className="p-2.5">Participantes</th>
                    <th className="p-2.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {parsedRows.map((row) => (
                    <tr
                      key={row.id}
                      className={row.valid ? 'hover:bg-slate-50/60' : 'bg-rose-50/50 dark:bg-rose-950/30'}
                    >
                      <td className="p-2.5">
                        {row.valid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedErrorRow(row)}
                            className="flex items-center gap-1 text-rose-600 hover:text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/70 hover:bg-rose-200 dark:hover:bg-rose-900 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-900 transition-colors font-bold shadow-2xs"
                            title="Haz clic para ver el error completo en un popup"
                          >
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[10px]">Ver error</span>
                          </button>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-[11px]">{row.raw.date}</td>
                      <td className="p-2.5 font-semibold text-slate-900 dark:text-white truncate max-w-[130px]">
                        {row.raw.title || <span className="text-rose-500 italic">Sin concepto</span>}
                        {row.errors.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedErrorRow(row)}
                            className="block text-left text-[10px] text-rose-600 dark:text-rose-400 font-medium truncate hover:underline mt-0.5 max-w-full"
                            title="Haz clic para ver el error completo"
                          >
                            ⚠️ {row.errors[0]}
                          </button>
                        )}
                      </td>
                      <td className="p-2.5 font-black text-slate-900 dark:text-white">
                        {row.raw.amount} {row.raw.currency}
                      </td>
                      <td className="p-2.5 truncate max-w-[100px]">
                        <span className={row.errors.some(e => e.includes('pagador') || e.includes('usuario')) ? 'text-rose-600 font-bold underline' : 'text-slate-700 dark:text-slate-300'}>
                          {row.raw.payer}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400 truncate max-w-[100px]">
                        {row.raw.participantsStr || 'Todos'}
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                          title="Eliminar esta fila con error"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab('upload')}
                className="flex-1"
              >
                Cargar otro archivo
              </Button>
              <Button
                type="button"
                variant="brand"
                disabled={hasErrors || validCount === 0}
                isLoading={isImporting}
                onClick={handleConfirmImport}
                className="flex-1 text-xs font-bold"
              >
                <Sparkles className="w-4 h-4" />
                {hasErrors
                  ? `Bloqueado (${errorCount} filas erróneas)`
                  : `Importar ${validCount} Gastos`}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Error Detail Popup Modal */}
      <Modal
        isOpen={!!selectedErrorRow}
        onClose={() => setSelectedErrorRow(null)}
        title="Detalle del Error en la Fila"
        description="Información detallada sobre los motivos que impiden importar este gasto"
        maxWidth="md"
      >
        {selectedErrorRow && (
          <div className="space-y-4">
            {/* Row Summary Card */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {selectedErrorRow.raw.title || '(Sin concepto)'}
                </span>
                <Badge variant="rose" size="sm">
                  {selectedErrorRow.errors.length} error(es)
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Fecha</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{selectedErrorRow.raw.date || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Importe</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedErrorRow.raw.amount} {selectedErrorRow.raw.currency}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Pagador</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedErrorRow.raw.payer || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Repartir</span>
                  <span className="text-slate-700 dark:text-slate-300">{selectedErrorRow.raw.participantsStr || 'Todos'}</span>
                </div>
              </div>
            </div>

            {/* Errors List */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                Motivos del fallo:
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedErrorRow.errors.map((err, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5"
                  >
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-semibold">{err}</p>
                      {err.includes('no está registrado') && (
                        <p className="text-[11px] text-rose-500/90 dark:text-rose-400">
                          💡 Sugerencia: Añade a esta persona como amiga en la pestaña &quot;Amigos&quot; del grupo antes de importar, o elimínala de esta fila.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons inside popup */}
            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedErrorRow(null)}
                className="flex-1 text-xs"
              >
                Cerrar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  handleDeleteRow(selectedErrorRow.id);
                  setSelectedErrorRow(null);
                }}
                className="flex-1 text-xs font-bold gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar esta Fila
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Modal>
  );
};
