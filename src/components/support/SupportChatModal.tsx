'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { SupportCategory, SupportMessage } from '@/types/database';
import { Send, Shield, Sparkles, MessageSquare, AlertCircle, HelpCircle, FileText, CheckCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: SupportCategory;
}

export const SupportChatModal: React.FC<SupportChatModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'general',
}) => {
  const { currentUser, isAppAdmin, supportMessages, sendSupportMessage, fetchSupportMessages, markSupportMessagesRead } = usePachas();
  const { t } = useTranslation();

  const [messageText, setMessageText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory>(initialCategory);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    if (isOpen) {
      fetchSupportMessages();
      markSupportMessagesRead();
      const interval = setInterval(() => {
        fetchSupportMessages();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [supportMessages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || isSending) return;

    const text = messageText.trim();
    setMessageText('');
    setIsSending(true);
    try {
      await sendSupportMessage(text, selectedCategory);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error('Error sending support message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const categories: Array<{ id: SupportCategory; label: string; icon: string }> = [
    { id: 'general', label: '💡 Pregunta General', icon: '💡' },
    { id: 'bug', label: '🐛 Notificar Bug', icon: '🐛' },
    { id: 'report_clarification', label: '⚖️ Aclaración Reporte', icon: '⚖️' },
    { id: 'appeal', label: '🛡️ Apelar Sanción', icon: '🛡️' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="💬 Chat Directo con el Administrador"
      maxWidth="lg"
    >
      <div className="flex flex-col h-[70vh] max-h-[580px]">
        {/* Top Info Banner & Category Selector */}
        <div className="pb-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Canal oficial de soporte y resolución de incidencias. Un administrador te responderá directamente.
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap transition-all border shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60 dark:bg-slate-950/40 rounded-2xl my-3 border border-slate-200/70 dark:border-slate-800/70">
          {supportMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl shadow-xs">
                💬
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  ¿En qué podemos ayudarte?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Escribe tu duda, reporte de fallo técnico o aclaración sobre un grupo. Los administradores recibirán tu mensaje en tiempo real.
                </p>
              </div>
            </div>
          ) : (
            supportMessages.map((msg) => {
              const isMine = msg.sender_role === 'user';
              const isAdmin = msg.sender_role === 'admin';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
                        <Shield className="w-3 h-3" />
                        <span>Administrador Pachas</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {msg.sender_name || 'Tú'}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {formatDate(msg.created_at, 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed shadow-2xs break-words ${
                      isMine
                        ? 'bg-emerald-600 text-white rounded-tr-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-tl-xs'
                    }`}
                  >
                    {msg.category && msg.category !== 'general' && (
                      <div className="mb-1.5">
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            isMine
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {msg.category === 'bug'
                            ? '🐛 Bug Report'
                            : msg.category === 'report_clarification'
                            ? '⚖️ Aclaración'
                            : msg.category === 'appeal'
                            ? '🛡️ Apelación'
                            : msg.category}
                        </span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer Form */}
        <form onSubmit={handleSend} className="flex items-center gap-2 pt-1">
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={`Escribe tu mensaje sobre ${
              selectedCategory === 'bug'
                ? 'un error o fallo técnico...'
                : selectedCategory === 'report_clarification'
                ? 'un reporte o viaje congelado...'
                : selectedCategory === 'appeal'
                ? 'tu cuenta suspendida...'
                : 'cualquier duda o pregunta...'
            }`}
            className="flex-1 text-xs"
            disabled={isSending}
          />
          <Button
            type="submit"
            variant="brand"
            disabled={!messageText.trim() || isSending}
            isLoading={isSending}
            className="px-4 font-bold shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Modal>
  );
};
