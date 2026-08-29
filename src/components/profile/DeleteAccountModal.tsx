'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/context/LanguageContext';
import { usePachas } from '@/context/PachasContext';
import { AlertTriangle, Trash2 } from 'lucide-react';

export interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { logout, currentUser } = usePachas();

  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const isConfirmed = confirmText.trim().toUpperCase() === 'ELIMINAR';

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) return;

    try {
      setIsDeleting(true);
      setError('');

      const res = await fetch('/api/user/delete-account', {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar la cuenta');
      }

      await logout();
      onClose();
      router.push('/login');
    } catch (err: any) {
      setError(err.message || 'Error al eliminar la cuenta');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('profile.deleteConfirmTitle')}
      description={t('profile.deleteConfirmSubtitle')}
      maxWidth="md"
    >
      <form onSubmit={handleDelete} className="space-y-4">
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed space-y-1">
            <p className="font-bold">Esta acción no se puede deshacer.</p>
            <p>
              Se eliminará tu cuenta vinculada a <strong>{currentUser?.email}</strong> y se desvincularán tus datos personales de los grupos en los que participas conforme al RGPD.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
            {t('profile.deleteConfirmTextPrompt')}
          </label>
          <Input
            placeholder="ELIMINAR"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            required
            className="font-mono font-bold"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="brand"
            size="sm"
            disabled={!isConfirmed}
            isLoading={isDeleting}
            className="bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            {t('profile.deleteConfirmBtn')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
