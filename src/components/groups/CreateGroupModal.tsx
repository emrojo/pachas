'use client';

import React, { useState } from 'react';
import { usePachas } from '@/context/PachasContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SUPPORTED_CURRENCIES } from '@/lib/currencies';
import { Sparkles } from 'lucide-react';

const EMOJI_PRESETS = [
  '🏖️', '🏔️', '🍕', '✈️', '⛵', '🚗', '⛺', '🎉', '🌴', '🍹', '🏰', '⛷️', '🌮', '🍣', '🎸', '🎒'
];

export interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (groupId: string) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { createGroup } = usePachas();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('🏖️');
  const [currency, setCurrency] = useState('EUR');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del grupo es obligatorio');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const newGroup = await createGroup(name.trim(), description.trim(), emoji, currency);
      setName('');
      setDescription('');
      onClose();
      if (onSuccess) onSuccess(newGroup.id);
    } catch (err: any) {
      setError(err.message || 'Error al crear el grupo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Grupo de Gastos"
      description="Crea un grupo para tus vacaciones, escapada de fin de semana o viaje con amigos"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Emoji Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            Icono del viaje
          </label>
          <div className="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-800">
            {EMOJI_PRESETS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setEmoji(item)}
                className={`w-10 h-10 rounded-lg text-2xl flex items-center justify-center transition-all ${
                  emoji === item
                    ? 'bg-white dark:bg-slate-700 shadow-md scale-110 ring-2 ring-emerald-500'
                    : 'hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Group Name */}
        <Input
          label="Nombre del Viaje / Grupo *"
          placeholder="Ej: Vacaciones Formentera 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          required
        />

        {/* Description */}
        <Input
          label="Descripción o Notas (Opcional)"
          placeholder="Ej: Gastos compartidos de hotel, cenas y barco"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Base Currency */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Moneda Principal del Grupo
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.symbol}) — {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="brand"
            isLoading={isLoading}
            className="flex-1"
          >
            Crear Grupo
          </Button>
        </div>
      </form>
    </Modal>
  );
};
