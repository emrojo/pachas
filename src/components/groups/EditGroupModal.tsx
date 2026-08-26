'use client';

import React, { useState, useEffect } from 'react';
import { Group } from '@/types/database';
import { usePachas } from '@/context/PachasContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SUPPORTED_CURRENCIES } from '@/lib/currencies';
import {
  Sparkles,
  Image as ImageIcon,
  Smile,
  Upload,
  Trash2,
  Check,
  Camera,
  Archive,
  ArchiveRestore,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const EMOJI_PRESETS = [
  '🏖️', '🏔️', '🍕', '✈️', '⛵', '🚗', '⛺', '🎉', '🌴', '🍹', '🏰', '⛷️', '🌮', '🍣', '🎸', '🎒', '🎡', '🏄', '🥂', '🏙️'
];

const PHOTO_PRESETS = [
  { label: 'Playa & Calas', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80' },
  { label: 'Montaña & Naturaleza', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop&q=80' },
  { label: 'Cena & Tapas', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80' },
  { label: 'Ciudad & Escapada', url: 'https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=500&auto=format&fit=crop&q=80' },
  { label: 'Fiesta & Noche', url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=80' },
  { label: 'Camping & Ruta', url: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=500&auto=format&fit=crop&q=80' },
];

import { validateAndCompressImage, sanitizeText } from '@/lib/security/sanitize';

export interface EditGroupModalProps {
  group: Group;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updated: Group) => void;
}

export const EditGroupModal: React.FC<EditGroupModalProps> = ({
  group,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { updateGroup, archiveGroup, restoreGroup, currentUser, getGroupMembers } = usePachas();

  const members = getGroupMembers(group.id);
  const isAdmin =
    currentUser
      ? group.created_by === currentUser.id ||
        members.some((m) => m.user_id === currentUser.id && m.role === 'admin')
      : false;

  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [emoji, setEmoji] = useState(group.icon_emoji || '🏖️');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(group.cover_image_url || null);
  const [visualMode, setVisualMode] = useState<'emoji' | 'photo'>(group.cover_image_url ? 'photo' : 'emoji');
  const [currency, setCurrency] = useState(group.base_currency || 'EUR');
  const [isLoading, setIsLoading] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(group.name);
      setDescription(group.description || '');
      setEmoji(group.icon_emoji || '🏖️');
      setCoverImageUrl(group.cover_image_url || null);
      setVisualMode(group.cover_image_url ? 'photo' : 'emoji');
      setCurrency(group.base_currency || 'EUR');
      setError('');
    }
  }, [isOpen, group]);

  // Handle local image file upload securely
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await validateAndCompressImage(file, 800, 0.85);
        setCoverImageUrl(compressed);
        setVisualMode('photo');
      } catch (err: any) {
        setError(err.message || 'Error al procesar la imagen seleccionada');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del grupo es obligatorio');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const updated = await updateGroup(group.id, {
        name: sanitizeText(name, 80),
        description: sanitizeText(description, 300) || null,
        icon_emoji: emoji,
        cover_image_url: visualMode === 'photo' ? coverImageUrl : null,
        base_currency: currency,
      });

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#10b981', '#059669', '#f59e0b'],
      });

      onClose();
      if (onSuccess) onSuccess(updated);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el grupo');
    } finally {
      setIsLoading(false);
    }
  };


  const handleToggleArchive = async () => {
    if (group.is_archived) {
      try {
        setIsArchiving(true);
        const restored = await restoreGroup(group.id);
        onClose();
        if (onSuccess) onSuccess(restored);
      } catch (err: any) {
        setError(err.message || 'Error al restaurar el grupo');
      } finally {
        setIsArchiving(false);
      }
    } else {
      if (
        confirm(
          `¿Estás seguro de que deseas archivar el grupo "${group.name}"? Los miembros ya no podrán verlo en su panel principal, pero tú podrás restaurarlo cuando quieras desde tu panel de administrador.`
        )
      ) {
        try {
          setIsArchiving(true);
          const archived = await archiveGroup(group.id);
          onClose();
          if (onSuccess) onSuccess(archived);
        } catch (err: any) {
          setError(err.message || 'Error al archivar el grupo');
        } finally {
          setIsArchiving(false);
        }
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ajustes del Grupo"
      description={`Personaliza el icono, foto y detalles de ${group.name}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Visual Identity Selector: Emoji vs Photo */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Icono / Fotografía del Grupo
            </label>

            {/* Switch Tabs */}
            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setVisualMode('emoji')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                  visualMode === 'emoji'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                Emoji
              </button>

              <button
                type="button"
                onClick={() => setVisualMode('photo')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                  visualMode === 'photo'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Foto / Imagen
              </button>
            </div>
          </div>

          {/* Mode 1: Emoji Selector */}
          {visualMode === 'emoji' && (
            <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-800">
              {EMOJI_PRESETS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEmoji(item)}
                  className={`w-10 h-10 rounded-xl text-2xl flex items-center justify-center transition-all ${
                    emoji === item
                      ? 'bg-white dark:bg-slate-700 shadow-md scale-110 ring-2 ring-emerald-500'
                      : 'hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          {/* Mode 2: Photo Upload & Presets */}
          {visualMode === 'photo' && (
            <div className="space-y-3">
              {/* Photo Preview or Dropzone */}
              {coverImageUrl ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/40 h-36 bg-slate-100 dark:bg-slate-800 group shadow-sm">
                  <img
                    src={coverImageUrl}
                    alt="Foto del grupo"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <label className="p-2 bg-white text-slate-800 rounded-xl cursor-pointer text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5 shadow-md">
                      <Camera className="w-4 h-4" />
                      <span>Cambiar foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setCoverImageUrl(null)}
                      className="p-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 flex items-center gap-1.5 shadow-md"
                      title="Eliminar foto"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Quitar</span>
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl hover:border-emerald-500 bg-slate-50 dark:bg-slate-800/40 cursor-pointer transition-colors text-center">
                  <Upload className="w-8 h-8 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Subir una fotografía desde tu dispositivo
                  </span>
                  <span className="text-[11px] text-slate-400">
                    JPG, PNG o WEBP (guardada en el grupo)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}

              {/* Photo presets */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  O elige una foto temática para este viaje:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {PHOTO_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCoverImageUrl(preset.url)}
                      className={`relative rounded-xl overflow-hidden h-14 border-2 transition-all ${
                        coverImageUrl === preset.url
                          ? 'border-emerald-500 ring-2 ring-emerald-500/40 scale-105'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                    >
                      <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold px-1 py-0.5 truncate text-center">
                        {preset.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
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

        {/* Admin Danger / Archive Zone */}
        {isAdmin && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              <span>Zona de Administrador</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  {group.is_archived ? 'Grupo archivado' : 'Archivar este grupo'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  {group.is_archived
                    ? 'Restaura el grupo para que vuelva a estar visible para todos los miembros.'
                    : 'Oculta el viaje de la vista principal. Solo tú podrás restaurarlo desde el panel.'}
                </span>
              </div>

              <Button
                type="button"
                variant={group.is_archived ? 'brand' : 'outline'}
                size="sm"
                isLoading={isArchiving}
                onClick={handleToggleArchive}
                className="shrink-0 text-xs font-bold gap-1.5"
              >
                {group.is_archived ? (
                  <>
                    <ArchiveRestore className="w-3.5 h-3.5" />
                    <span>Restaurar</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-3.5 h-3.5 text-amber-600" />
                    <span>Archivar</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" variant="brand" isLoading={isLoading} className="flex-1 text-xs font-bold gap-1.5">
            <Check className="w-4 h-4" />
            Guardar Cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
};
