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
  CornerDownRight,
  Reply,
  Receipt,
  ExternalLink,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { formatMoney } from '@/lib/currencies';
import { EmojiPickerPopover } from '@/components/expenses/EmojiPickerPopover';
import { GifPickerModal } from '@/components/expenses/GifPickerModal';
import { GroupMember, GroupMessage } from '@/types/database';

export interface GroupChatSectionProps {
  groupId: string;
  groupName?: string;
  members: GroupMember[];
  isAdmin?: boolean;
  targetMessageId?: string;
}

const QUICK_REACTIONS = ['❤️', '👍', '😂', '🎉', '🔥', '👏'];

export const GroupChatSection: React.FC<GroupChatSectionProps> = ({
  groupId,
  groupName,
  members,
  isAdmin = false,
  targetMessageId,
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
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    authorName: string;
    textSnippet: string;
    expenseId?: string | null;
    expenseTitle?: string | null;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Pickers state
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);
  const [reactingMessage, setReactingMessage] = useState<{ id: string; anchorEl: HTMLElement } | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const isJustSentRef = useRef<boolean>(false);

  const messages = getGroupMessages(groupId);

  // Fetch messages from backend on mount
  useEffect(() => {
    if (groupId) {
      fetchGroupMessages(groupId);
    }
  }, [groupId]);

  // Deep link to targetMessageId from notification
  useEffect(() => {
    if (!targetMessageId || messages.length === 0) return;
    const element = document.getElementById(`group-msg-${targetMessageId}`);
    if (element && chatContainerRef.current) {
      const containerTop = chatContainerRef.current.getBoundingClientRect().top;
      const elementTop = element.getBoundingClientRect().top;
      chatContainerRef.current.scrollBy({
        top: elementTop - containerTop - 80,
        behavior: 'smooth',
      });
      setHighlightedId(targetMessageId);
      const timer = setTimeout(() => {
        setHighlightedId((curr) => (curr === targetMessageId ? null : curr));
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [targetMessageId, messages.length]);

  // Contained scroll to bottom on new messages without jarring window jumps
  useEffect(() => {
    if (!chatContainerRef.current) return;
    const container = chatContainerRef.current;
    const { scrollHeight, clientHeight, scrollTop } = container;
    const isNearBottom = scrollHeight - clientHeight - scrollTop < 160;

    if (isNearBottom || isJustSentRef.current) {
      container.scrollTo({
        top: scrollHeight,
        behavior: isJustSentRef.current ? 'smooth' : 'auto',
      });
      isJustSentRef.current = false;
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
      isJustSentRef.current = true;
      await addGroupMessage(
        groupId,
        messageText.trim(),
        selectedGifUrl,
        replyingTo?.id || null,
        replyingTo
          ? {
              id: replyingTo.id,
              author_name: replyingTo.authorName,
              message: replyingTo.textSnippet,
              expense_id: replyingTo.expenseId || null,
              expense_title: replyingTo.expenseTitle || null,
            }
          : null,
        replyingTo?.expenseId || null
      );
      setMessageText('');
      setSelectedGifUrl(null);
      setReplyingTo(null);
    } catch (err: any) {
      alert(err.message || 'Error al enviar el mensaje.');
    } finally {
      setIsSubmitting(false);
      inputRef.current?.focus({ preventScroll: true });
    }
  };

  const handleStartReply = (msg: GroupMessage, authorProfile: any) => {
    const authorName = authorProfile?.full_name?.split(' ')[0] || 'Amigo';
    const textSnippet = msg.message?.trim()
      ? msg.message.length > 70
        ? msg.message.slice(0, 67) + '...'
        : msg.message
      : '🎬 GIF animado';

    setReplyingTo({
      id: msg.id,
      authorName,
      textSnippet,
      expenseId: msg.expense_id || null,
      expenseTitle: msg.expense_title || null,
    });
    if (inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
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
      inputRef.current.focus({ preventScroll: true });
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    await toggleGroupMessageReaction(messageId, groupId, emoji);
  };

  return (
    <div className="flex flex-col h-[560px] bg-slate-50/50 dark:bg-slate-900/40 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
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
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 custom-scrollbar">
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
                {t('chat.emptySubtitle') || 'Sé el primero en saludar a tus amigos, proponer planes o comentar gastos.'}
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
                id={`group-msg-${msg.id}`}
                className={`flex items-start gap-2.5 ${isAuthor ? 'flex-row-reverse' : 'flex-row'} group p-1.5 rounded-2xl transition-all duration-700 ${
                  highlightedId === msg.id
                    ? 'ring-2 ring-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/50 shadow-md scale-[1.01]'
                    : ''
                }`}
              >
                {/* Author Avatar */}
                <Avatar profile={authorProfile} size="sm" className="mt-0.5 shrink-0" />

                {/* Message Bubble Container */}
                <div className={`flex flex-col max-w-[85%] sm:max-w-[72%] ${isAuthor ? 'items-end' : 'items-start'}`}>
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
                    {/* Quoted Reply Block */}
                    {msg.reply_to_snippet && (
                      <div
                        className={`mb-2.5 p-2 rounded-xl text-[11px] border-l-3 ${
                          isAuthor
                            ? 'bg-black/15 border-white/70 text-white/90'
                            : 'bg-slate-100 dark:bg-slate-700/60 border-emerald-500 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5">
                          <CornerDownRight className="w-3 h-3 shrink-0" />
                          <span>{msg.reply_to_snippet.author_name}</span>
                          {msg.reply_to_snippet.expense_title && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-semibold truncate max-w-[130px]">
                              💸 {msg.reply_to_snippet.expense_title}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-1 italic text-[10.5px] opacity-90 mt-0.5">
                          {msg.reply_to_snippet.message}
                        </p>
                      </div>
                    )}

                    {/* Linked Expense Banner */}
                    {msg.expense_id && (
                      <div
                        className={`mb-2.5 p-2.5 rounded-xl border flex items-center justify-between gap-2.5 ${
                          isAuthor
                            ? 'bg-white/15 border-white/30 text-white'
                            : 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs">
                            💸
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              {t('chat.expenseBadge') || 'Gasto vinculado'}
                            </div>
                            <div className="font-bold text-xs truncate">
                              {msg.expense_title || 'Gasto del grupo'}
                              {msg.expense_amount !== null && msg.expense_amount !== undefined && (
                                <span className="ml-1 font-semibold text-[11px] opacity-90 tabular-nums">
                                  ({formatMoney(msg.expense_amount, msg.expense_currency || 'EUR')})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <a
                          href={`/groups/${groupId}?tab=expenses&expenseId=${msg.expense_id}`}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-colors flex items-center gap-1 ${
                            isAuthor
                              ? 'bg-white text-emerald-800 hover:bg-white/90'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          <span>{t('chat.viewExpense') || 'Ver gasto'}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    )}

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

                    {/* Hover Quick Actions Toolbar */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-slate-200 dark:border-slate-700 rounded-xl px-1.5 py-0.5 shadow-md ${
                        isAuthor ? '-left-24' : '-right-24'
                      }`}
                    >
                      {/* Reply Button */}
                      <button
                        type="button"
                        onClick={() => handleStartReply(msg, authorProfile)}
                        className="p-1 text-slate-500 hover:text-emerald-600 rounded-lg transition-colors"
                        title={t('chat.reply') || 'Responder'}
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>

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
                            <span className="text-[10px] opacity-80 tabular-nums">{userIds.length}</span>
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
      </div>

      {/* Replying To Banner above input */}
      {replyingTo && (
        <div className="px-4 py-2 bg-emerald-50/90 dark:bg-emerald-950/70 border-t border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <CornerDownRight className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <span className="font-bold text-emerald-900 dark:text-emerald-100">
                {t('chat.replyingTo') || 'Respondiendo a'} {replyingTo.authorName}:
              </span>
              <span className="ml-1 text-emerald-700 dark:text-emerald-300 truncate inline-block max-w-[200px] sm:max-w-md align-bottom italic">
                "{replyingTo.textSnippet}"
              </span>
              {replyingTo.expenseId && (
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                  <span>💸 {t('chat.syncWithExpenseNotice') || 'Se añadirá también como comentario en el gasto'}</span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1 text-slate-400 hover:text-rose-500 rounded-lg shrink-0"
            title={t('chat.cancelReply') || 'Cancelar respuesta'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
          placeholder={
            replyingTo
              ? `${t('chat.replyingTo') || 'Respondiendo a'} ${replyingTo.authorName}...`
              : (t('chat.placeholder') || 'Escribe un mensaje al grupo...')
          }
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
