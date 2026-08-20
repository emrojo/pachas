'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePachas } from '@/context/PachasContext';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ExpenseCard } from '@/components/expenses/ExpenseCard';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { ImportExpensesModal } from '@/components/expenses/ImportExpensesModal';
import { TripRouteMapModal } from '@/components/expenses/TripRouteMapModal';
import { InviteModal } from '@/components/groups/InviteModal';
import { EditGroupModal } from '@/components/groups/EditGroupModal';
import { MemberList } from '@/components/groups/MemberList';
import { BalanceSummary } from '@/components/balances/BalanceSummary';
import { DebtList } from '@/components/balances/DebtList';
import { CATEGORIES } from '@/lib/categories';
import { formatMoney } from '@/lib/currencies';
import { formatDate } from '@/lib/utils';
import { exportGroupToPDF, exportGroupToCSV } from '@/lib/export';
import { ExpenseCategory, Expense } from '@/types/database';
import {
  ArrowLeft,
  Plus,
  QrCode,
  Share2,
  FileDown,
  Receipt,
  Users,
  HandCoins,
  History,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
  UploadCloud,
  Undo2,
  Settings,
  Camera,
  Pencil,
  Compass,
  MapPin,
} from 'lucide-react';

type TabType = 'expenses' | 'balances' | 'members' | 'history';

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params?.id as string;

  const {
    getGroup,
    getGroupMembers,
    getGroupExpenses,
    getGroupSettlements,
    getGroupBalances,
    getGroupDebts,
    currentUser,
    lastImportBatch,
    undoLastImport,
  } = usePachas();

  const group = getGroup(groupId);
  const members = getGroupMembers(groupId);
  const expenses = getGroupExpenses(groupId);
  const settlements = getGroupSettlements(groupId);
  const balances = getGroupBalances(groupId);
  const debts = getGroupDebts(groupId);

  const [activeTab, setActiveTab] = useState<TabType>('expenses');
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [isRouteMapOpen, setIsRouteMapOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!group) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Card className="text-center p-8 max-w-md w-full">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3 text-2xl">
            🏖️
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Grupo no encontrado
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            El grupo que buscas no existe o ha sido eliminado.
          </p>
          <Link href="/dashboard">
            <Button variant="brand" className="w-full">
              Volver al inicio
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const totalSpent = expenses.reduce(
    (sum, e) => sum + (e.converted_amount || e.amount),
    0
  );

  const filteredExpenses = expenses.filter((e) => {
    const matchesCategory =
      selectedCategory === 'all' || e.category === selectedCategory;
    const matchesQuery =
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const handleOpenNewExpense = () => {
    setEditingExpense(null);
    setIsExpenseFormOpen(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setIsExpenseFormOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 md:pb-12">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-4 sm:py-6 space-y-5">
        {/* Back Link & Header Card */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a mis viajes
          </Link>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
            {/* Optional Cover Banner */}
            {group.cover_image_url && (
              <div className="relative h-36 sm:h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-800 group">
                <img
                  src={group.cover_image_url}
                  alt={group.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <button
                  type="button"
                  onClick={() => setIsEditGroupOpen(true)}
                  className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-xl backdrop-blur-md flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Cambiar foto</span>
                </button>
              </div>
            )}

            <div className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Trip Identity */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setIsEditGroupOpen(true)}
                    className="relative group shrink-0"
                    title="Haz clic para cambiar el icono o foto del grupo"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-4xl shadow-xs group-hover:scale-105 transition-transform">
                      {group.icon_emoji}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-1 border border-slate-200 dark:border-slate-700 text-slate-500 shadow-xs group-hover:text-emerald-600 transition-colors">
                      <Pencil className="w-3 h-3" />
                    </div>
                  </button>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        {group.name}
                      </h1>
                      <Badge variant="emerald" size="sm">
                        {group.base_currency}
                      </Badge>
                    </div>
                    {group.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {group.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                      <span>{members.length} amigos</span>
                      <span>•</span>
                      <span>{expenses.length} gastos</span>
                      <span>•</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        Total: {formatMoney(totalSpent, group.base_currency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditGroupOpen(true)}
                    title="Ajustes y foto del viaje"
                    className="gap-1.5"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span className="hidden sm:inline">Ajustes</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsInviteOpen(true)}
                    className="gap-1.5"
                  >
                    <QrCode className="w-4 h-4 text-emerald-600" />
                    Invitar
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsRouteMapOpen(true)}
                    title="Ver ruta e itinerario de gastos en el mapa"
                    className="gap-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50"
                  >
                    <Compass className="w-4 h-4 text-emerald-600" />
                    <span className="hidden sm:inline font-bold">Itinerario en Mapa</span>
                  </Button>

                  {/* Export Dropdown / Buttons */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportGroupToPDF(group, expenses, balances, debts)}
                    title="Descargar resumen en PDF"
                    className="gap-1.5"
                  >
                    <FileDown className="w-4 h-4 text-rose-500" />
                    PDF
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportGroupToCSV(group, expenses, balances)}
                    title="Descargar en Excel/CSV"
                    className="gap-1.5"
                  >
                    CSV
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsImportModalOpen(true)}
                    title="Importar gastos desde Excel o CSV"
                    className="gap-1.5"
                  >
                    <UploadCloud className="w-4 h-4 text-emerald-600" />
                    Importar
                  </Button>

                  <Button
                    size="sm"
                    variant="brand"
                    onClick={handleOpenNewExpense}
                    className="gap-1.5 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Añadir Gasto
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'expenses'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Gastos ({expenses.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('balances')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'balances'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <HandCoins className="w-4 h-4" />
            Saldos & Liquidación
            {debts.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'members'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            Amigos ({members.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <History className="w-4 h-4" />
            Pagos Realizados ({settlements.length})
          </button>
        </div>

        {/* Tab 1: Gastos */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            {/* Banner de Deshacer Importación */}
            {lastImportBatch && lastImportBatch.groupId === group.id && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
                      Se han importado {lastImportBatch.count} gasto{lastImportBatch.count > 1 ? 's' : ''} desde archivo
                    </span>
                    <span className="text-[11px] text-amber-700/80 dark:text-amber-400 block truncate">
                      ¿Te has equivocado? Puedes revertir esta importación ahora mismo.
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (confirm(`¿Deseas deshacer la importación y eliminar los ${lastImportBatch.count} gastos importados?`)) {
                      const removed = await undoLastImport(group.id);
                      alert(`Se ha deshecho la importación. Se eliminaron ${removed} gastos.`);
                    }
                  }}
                  className="text-xs font-bold bg-white dark:bg-slate-900 border-amber-300 text-amber-900 dark:text-amber-200 hover:bg-amber-100 shrink-0 gap-1"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Deshacer importación
                </Button>
              </div>
            )}

            {/* Category Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                Todas las categorías
              </button>
              {Object.values(CATEGORIES).map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="max-w-md">
              <Input
                placeholder="Buscar por concepto o notas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>

            {/* Expenses List */}
            {filteredExpenses.length === 0 ? (
              <Card className="text-center py-12 border-dashed">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto mb-3 text-2xl">
                  🧾
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No hay gastos en esta categoría
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Añade un gasto de cena, alojamiento o transporte para repartirlo con tus amigos.
                </p>
                <Button variant="brand" onClick={handleOpenNewExpense}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Añadir el primer gasto
                </Button>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {filteredExpenses.map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    baseCurrency={group.base_currency}
                    onEdit={handleEditExpense}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Saldos & Liquidación */}
        {activeTab === 'balances' && (
          <div className="space-y-6">
            <BalanceSummary
              group={group}
              balances={balances}
              totalSpent={totalSpent}
            />

            <DebtList group={group} debts={debts} />
          </div>
        )}

        {/* Tab 3: Amigos / Participantes */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Amigos en el Grupo
                </h3>
                <p className="text-xs text-slate-500">
                  Todos los miembros que participan en los gastos de este viaje
                </p>
              </div>
              <Button
                size="sm"
                variant="brand"
                onClick={() => setIsInviteOpen(true)}
              >
                <QrCode className="w-4 h-4 mr-1" />
                Invitar amigos
              </Button>
            </div>

            <Card>
              <MemberList members={members} />
            </Card>
          </div>
        )}

        {/* Tab 4: Historial de Liquidaciones */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Historial de Pagos y Liquidaciones
            </h3>

            {settlements.length === 0 ? (
              <Card className="text-center py-10 border-dashed">
                <p className="text-xs text-slate-500">
                  Aún no se ha registrado ningún pago entre amigos en este viaje.
                </p>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {settlements.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold text-sm">
                        ✓
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {s.from_profile?.full_name || 'Amigo'} pagó a{' '}
                          {s.to_profile?.full_name || 'Amigo'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{formatDate(s.settled_at, 'dd/MM/yyyy HH:mm')}</span>
                          <span>•</span>
                          <span className="font-semibold text-emerald-600">
                            {s.payment_method}
                          </span>
                          {s.notes && (
                            <>
                              <span>•</span>
                              <span>{s.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatMoney(s.amount, s.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav onAddClick={handleOpenNewExpense} groupId={group.id} />

      <ExpenseForm
        groupId={group.id}
        isOpen={isExpenseFormOpen}
        onClose={() => {
          setIsExpenseFormOpen(false);
          setEditingExpense(null);
        }}
        expenseToEdit={editingExpense}
      />

      <InviteModal
        group={group}
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />

      <ImportExpensesModal
        groupId={group.id}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      <EditGroupModal
        group={group}
        isOpen={isEditGroupOpen}
        onClose={() => setIsEditGroupOpen(false)}
      />

      <TripRouteMapModal
        group={group}
        expenses={expenses}
        isOpen={isRouteMapOpen}
        onClose={() => setIsRouteMapOpen(false)}
      />
    </div>
  );
}
