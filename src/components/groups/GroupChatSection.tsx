'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import {
  MessageSquare,
  Send,
  Trash2,
  Smile,
  Film,
  X,
  Shield,
  Clock,
  Sparkles,
  Users,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { EmojiPickerPopover } from '@/components/expenses/EmojiPickerPopover';
import { GifPickerModal } from '@/components/expenses/GifPickerModal';
import { GroupMember } from '@/types/database';

export interface GroupChatSectionProps {
  groupId: string;
  groupName?: string;
  members: GroupMember[];
  isAdmin?: boolean;
}

const QUICK_REACTIONS = ['❤️', '👍', '😂', '🎉', '🔥', '👏'];

export const GroupChatSection: React.FC<GroupChatSectionProps> = ({
  groupId,
  groupName,
  members,
  isAdmin = false,
}) => {
  const {
    currentUser,
    getGroupMessages,
    addGroupMessage,
    deleteGroupMessage,
    fetchGroupMessages,
    toggleGroupMessageReaction,
    availableUsers,
  } = usePachas();
  const { t } = useTranslation();

  const [messageText, setMessageText] = useState('');
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Pickers state
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);
  const [reactingMessage, setReactingMessage] = useState<{ id: string; anchorEl: HTMLElement } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const messages = getGroupMessages(groupId);

  // Fetch messages from backend on mount
  useEffect(() => {
    if (groupId) {
      fetchGroupMessages(groupId);
    }
  }, [groupId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Helper to resolve real author profile
  const getAuthorProfile = (userId: string, initialProfile?: any) => {
    if (initialProfile?.full_name && initialProfile.full_name !== 'Amigo') {
      return initialProfile;
    }
    if (currentUser && currentUser.id === userId) {
      return currentUser;
    }
    const fromAvailable = availableUsers.find((u) => u.id === userId);
    if (fromAvailable) return fromAvailable;

    const fromMember = members.find((m) => m.user_id === userId);
    if (fromMember?.profile) return fromMember.profile;

    return {
      id: userId,
      email: '',
      full_name: 'Amigo',
      avatar_url: null,
    };
  };

  const handleSendMessage = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const hasText = Boolean(messageText.trim());
    const hasGif = Boolean(selectedGifUrl);
    if ((!hasText && !hasGif) || isSubmitting || !currentUser) return;

    try {
      setIsSubmitting(true);
      await addGroupMessage(groupId, messageText.trim(), selectedGifUrl);
      setMessageText('');
      setSelectedGifUrl(null);
    } catch (err: any) {
      alert(err.message || 'Error al enviar el mensaje.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm(t('chat.deleteConfirm') || '¿Eliminar este mensaje del chat?')) return;
    try {
      setDeletingId(messageId);
      await deleteGroupMessage(messageId, groupId);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el mensaje.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    setMessageText((prev) => prev + emoji);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    await toggleGroupMessageReaction(messageId, groupId, emoji);
  };

  return (
    <div className="flex flex-col h-[520px] bg-slate-50/50 dark:bg-slate-900/40 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
      {/* Chat Header */}
      <div className="px-5 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>{t('chat.title') || 'Chat del Grupo'}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                {messages.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('chat.subtitle') || 'Conversación privada para todos los miembros de'} {groupName || 'este grupo'}
            </p>
          </div>
        </div>

        {/* Member Avatars Stack */}
        <div className="flex items-center -space-x-2 overflow-hidden py-1">
          {members.slice(0, 4).map((m) => (
            <Avatar
              key={m.id}
              profile={m.profile}
              size="sm"
              className="border-2 border-white dark:border-slate-900"
            />
          ))}
          {members.length > 4 && (
            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center border-2 border-white dark:border-slate-900">
              +{members.length - 4}
            </div>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-amber-500" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {t('chat.emptyTitle') || '¡Aún no hay mensajes!'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                {t('chat.emptySubtitle') || 'Sé el primero en saludar a tus amigos, proponer planes o compartir notas para el viaje.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              {['¡Hola a todos! 👋', '¿Qué planes tenemos hoy? 🌴', '¡Ya he pagado mi parte! 💸'].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setMessageText(prompt);
                    if (inputRef.current) inputRef.current.focus();
                  }}
                  className="px-3 py-1 rounded-full text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-2xs"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isAuthor = currentUser?.id === msg.user_id;
            const authorProfile = getAuthorProfile(msg.user_id, msg.profile);
            const isGroupAdmin = members.some((m) => m.user_id === msg.user_id && m.role === 'admin');
            const canDelete = isAuthor || isAdmin;
            const reactions = msg.reactions || {};
            const reactionEntries = Object.entries(reactions);

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${isAuthor ? 'flex-row-reverse' : 'flex-row'} group`}
              >
                {/* Author Avatar */}
                <Avatar profile={authorProfile} size="sm" className="mt-0.5 shrink-0" />

                {/* Message Bubble Container */}
                <div className={`flex flex-col max-w-[82%] sm:max-w-[70%] ${isAuthor ? 'items-end' : 'items-start'}`}>
                  {/* Author Name and Timestamp */}
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {isAuthor ? t('common.you') : authorProfile.full_name?.split(' ')[0] || 'Amigo'}
                    </span>
                    {isGroupAdmin && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[9px] font-bold flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" />
                        Admin
                      </span>
                    )}
                    <span>•</span>
                    <span>{formatDate(msg.created_at, 'HH:mm')}</span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`relative p-3.5 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                      isAuthor
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-xs'
                    }`}
                  >
                    {/* Message Text */}
                    {msg.message && (
                      <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    )}

                    {/* GIF Attachment */}
                    {msg.gif_url && (
                      <div className={`mt-2 rounded-xl overflow-hidden max-w-[260px] border ${isAuthor ? 'border-white/20' : 'border-slate-200 dark:border-slate-700'}`}>
                        <img
                          src={msg.gif_url}
                          alt="GIF"
                          className="w-full h-auto object-cover max-h-48"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Hover Quick Actions */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs border border-slate-200 dark:border-slate-700 rounded-xl px-1.5 py-0.5 shadow-md ${
                        isAuthor ? '-left-16' : '-right-16'
                      }`}
                    >
                      {/* React trigger */}
                      <button
                        type="button"
                        onClick={(e) => setReactingMessage({ id: msg.id, anchorEl: e.currentTarget })}
                        className="p-1 text-slate-500 hover:text-amber-500 rounded-lg transition-colors"
                        title="Reaccionar"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(msg.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          title="Eliminar mensaje"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Emoji Reactions List */}
                  {reactionEntries.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-1.5 px-0.5">
                      {reactionEntries.map(([emoji, userIds]) => {
                        const hasReacted = currentUser ? userIds.includes(currentUser.id) : false;
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all ${
                              hasReacted
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-[10px] opacity-80">{userIds.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selected GIF Preview above input */}
      {selectedGifUrl && (
        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              GIF seleccionado para enviar
            </span>
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600">
              <img src={selectedGifUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedGifUrl(null)}
            className="p-1 text-slate-400 hover:text-rose-500 rounded-lg"
            title="Quitar GIF"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Box Footer */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center gap-2"
      >
        {/* Emoji Button */}
        <button
          ref={emojiButtonRef}
          type="button"
          onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
          className="p-2.5 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Añadir emoji"
        >
          <Smile className="w-4 h-4" />
        </button>

        {/* GIF Button */}
        <button
          type="button"
          onClick={() => setIsGifModalOpen(true)}
          className="p-2.5 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Buscar GIF"
        >
          <Film className="w-4 h-4" />
        </button>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder={t('chat.placeholder') || 'Escribe un mensaje al grupo...'}
          className="flex-1 bg-slate-100 dark:bg-slate-800/80 border-0 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          disabled={isSubmitting}
        />

        {/* Send Button */}
        <Button
          type="submit"
          variant="brand"
          size="sm"
          disabled={(!messageText.trim() && !selectedGifUrl) || isSubmitting}
          isLoading={isSubmitting}
          className="rounded-2xl px-4 h-10 font-bold shrink-0 shadow-xs"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>

      {/* Floating Emoji Popover for Input */}
      {isEmojiPickerOpen && (
        <EmojiPickerPopover
          isOpen={isEmojiPickerOpen}
          onClose={() => setIsEmojiPickerOpen(false)}
          anchorEl={emojiButtonRef.current}
          onSelectEmoji={handleInsertEmoji}
        />
      )}

      {/* Floating Quick Reaction Popover on Message */}
      {reactingMessage && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 shadow-xl flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: reactingMessage.anchorEl.getBoundingClientRect().top - 48,
            left: Math.max(16, reactingMessage.anchorEl.getBoundingClientRect().left - 100),
          }}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                handleToggleReaction(reactingMessage.id, emoji);
                setReactingMessage(null);
              }}
              className="p-1.5 text-lg hover:scale-125 transition-transform rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setReactingMessage(null)}
            className="p-1 text-slate-400 hover:text-slate-600 text-xs ml-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* GIF Picker Modal */}
      <GifPickerModal
        isOpen={isGifModalOpen}
        onClose={() => setIsGifModalOpen(false)}
        onSelectGif={(url) => {
          setSelectedGifUrl(url);
          setIsGifModalOpen(false);
        }}
      />
    </div>
  );
};
