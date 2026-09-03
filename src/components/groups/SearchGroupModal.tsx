'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Group } from '@/types/database';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Search, Users, ArrowRight, X } from 'lucide-react';

export interface SearchGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  getGroupMembersCount?: (groupId: string) => number;
}

export const SearchGroupModal: React.FC<SearchGroupModalProps> = ({
  isOpen,
  onClose,
  groups,
  getGroupMembersCount,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const filtered = groups.filter((g) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      (g.description || '').toLowerCase().includes(q)
    );
  });

  const handleModalClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title={t('dashboard.searchGroups') || 'Buscar grupos'}
      description={t('dashboard.searchGroups') ? undefined : 'Encuentra rápidamente cualquiera de tus grupos de viaje o pachas.'}
    >
      <div className="space-y-4 pt-1">
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('dashboard.searchGroups') || 'Buscar por nombre o descripción...'}
            leftIcon={<Search className="w-4 h-4 text-emerald-600" />}
            autoFocus
            className="pr-8"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar pr-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 space-y-1">
              <p className="text-sm font-semibold">No se encontraron grupos</p>
              <p className="text-xs text-slate-400">Prueba con otro término de búsqueda</p>
            </div>
          ) : (
            filtered.map((grp) => {
              const membersCount = getGroupMembersCount ? getGroupMembersCount(grp.id) : 0;
              return (
                <Link
                  key={grp.id}
                  href={`/groups/${grp.id}`}
                  onClick={handleModalClose}
                  className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 hover:border-emerald-200 dark:hover:border-emerald-800/60 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                      {grp.cover_image_url ? (
                        <img
                          src={grp.cover_image_url}
                          alt={grp.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        '🏖️'
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                        {grp.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        {membersCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {membersCount}
                          </span>
                        )}
                        {grp.base_currency && (
                          <span>• {grp.base_currency}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-transform group-hover:translate-x-1 shrink-0 ml-2" />
                </Link>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={handleModalClose}>
            {t('common.close') || 'Cerrar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
