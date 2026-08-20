'use client';

import React, { useState } from 'react';
import { Group, Profile } from '@/types/database';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Share2, Mail, MessageCircle, UserPlus, Sparkles } from 'lucide-react';
import { usePachas } from '@/context/PachasContext';
import confetti from 'canvas-confetti';

export interface InviteModalProps {
  group: Group;
  isOpen: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ group, isOpen, onClose }) => {
  const { addMemberByEmail, addMemberToGroup, availableUsers, getGroupMembers, isDemoMode } = usePachas();
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  const groupMembers = getGroupMembers(group.id);
  const nonMemberUsers = availableUsers.filter(
    (u) => !groupMembers.some((m) => m.user_id === u.id || m.profile?.email?.toLowerCase() === u.email.toLowerCase())
  );

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pachas.app';
  const inviteUrl = `${baseUrl}/join/${group.invite_code}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const text = `¡Hola! Únete al grupo "${group.name}" en Pachas para compartir los gastos de las vacaciones: ${inviteUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Introduce un email o nombre de usuario');
      return;
    }

    try {
      setEmailStatus('loading');
      setErrorMessage('');
      const added = await addMemberByEmail(group.id, email.trim());
      if (added) {
        setEmailStatus('success');
        setEmail('');
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#10b981', '#34d399', '#f59e0b'],
        });
        setTimeout(() => setEmailStatus('idle'), 3000);
      } else {
        setErrorMessage('Este usuario ya forma parte del grupo');
        setEmailStatus('error');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al añadir');
      setEmailStatus('error');
    }
  };

  const handleQuickAddLocalUser = async (user: Profile) => {
    try {
      setAddingUserId(user.id);
      await addMemberToGroup(group.id, user.id);
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#3b82f6', '#f59e0b'],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setAddingUserId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Invitar amigos a ${group.name}`}
      description="Comparte este enlace o añade a tus amigos de prueba locales al grupo"
      maxWidth="md"
    >
      <div className="space-y-5">
        {/* Quick Add Demo Local Users (Visible only in Demo / Development mode) */}
        {isDemoMode && nonMemberUsers.length > 0 && (
          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Añadir usuarios de prueba disponibles ({nonMemberUsers.length}):</span>
              </div>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                Modo Local
              </span>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {nonMemberUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-between gap-2 shadow-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar profile={u} size="sm" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                        {u.full_name}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">{u.email}</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="brand"
                    disabled={addingUserId === u.id}
                    isLoading={addingUserId === u.id}
                    onClick={() => handleQuickAddLocalUser(u)}
                    className="text-xs h-7 px-2.5 shrink-0 gap-1"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Añadir</span>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QR Code & Link */}
        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="p-3 bg-white rounded-xl shadow-xs">
            <QRCodeSVG value={inviteUrl} size={130} level="M" />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-2.5">
            Escanea con la cámara del móvil
          </span>
        </div>

        {/* Copy Link Input */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Enlace de Invitación
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="flex-1 text-xs font-mono bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 select-all"
            />
            <Button
              size="sm"
              variant={copied ? 'brand' : 'secondary'}
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              {copied ? '¡Copiado!' : 'Copiar'}
            </Button>
          </div>
        </div>

        {/* Fast WhatsApp Share */}
        <div>
          <Button
            type="button"
            onClick={handleWhatsAppShare}
            className="w-full bg-[#25D366] hover:bg-[#1EBE5D] text-white font-semibold py-2.5 flex items-center justify-center gap-2 shadow-xs"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            Compartir por WhatsApp
          </Button>
        </div>

        {/* Invite by Email / Name */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
            O añadir escribiendo su email o nombre
          </label>
          <form onSubmit={handleEmailInvite} className="flex gap-2">
            <Input
              placeholder="Ej: sofia@pachas.com o Sofía"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="py-2 text-xs"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              isLoading={emailStatus === 'loading'}
              className="shrink-0"
            >
              <Mail className="w-4 h-4" />
              Añadir
            </Button>
          </form>
          {emailStatus === 'success' && (
            <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> ¡Amigo añadido con éxito al grupo!
            </p>
          )}
          {errorMessage && <p className="text-xs text-rose-500 font-medium mt-1.5">{errorMessage}</p>}
        </div>
      </div>
    </Modal>
  );
};
