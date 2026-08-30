'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { MessageSquare, Send, Trash2, Loader2, Smile, Film, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { EmojiPickerPopover } from './EmojiPickerPopover';
import { GifPickerModal } from './GifPickerModal';

export interface ExpenseCommentsSectionProps {
  expenseId: string;
  expenseTitle?: string;
  groupId?: string;
}

export const ExpenseCommentsSection: React.FC<ExpenseCommentsSectionProps> = ({
  expenseId,
  expenseTitle,
  groupId,
}) => {
  const {
    currentUser,
    getExpenseComments,
    addExpenseComment,
    deleteExpenseComment,
    fetchExpenseComments,
    toggleCommentReaction,
    availableUsers,
    getGroupMembers,
  } = usePachas();
  const { t } = useTranslation();

  const [commentText, setCommentText] = useState('');
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Pickers state
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);
  const [reactingComment, setReactingComment] = useState<{ id: string; anchorEl: HTMLElement } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const comments = getExpenseComments(expenseId);

  // Fetch comments from backend on mount
  useEffect(() => {
    if (expenseId) {
      fetchExpenseComments(expenseId);
    }
  }, [expenseId]);

  const groupMembers = groupId ? getGroupMembers(groupId) : [];

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

    const fromMember = groupMembers.find((m) => m.user_id === userId);
    if (fromMember?.profile) return fromMember.profile;

    return {
      id: userId,
      email: '',
      full_name: 'Amigo',
      avatar_url: null,
    };
  };

  const handleSendComment = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const hasText = Boolean(commentText.trim());
    const hasGif = Boolean(selectedGifUrl);
    if ((!hasText && !hasGif) || isSubmitting || !currentUser) return;

    try {
      setIsSubmitting(true);
      await addExpenseComment(expenseId, commentText.trim(), selectedGifUrl);
      setCommentText('');
      setSelectedGifUrl(null);
    } catch (err: any) {
      alert(err.message || 'Error al enviar el comentario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm(t('comments.confirmDelete') || '¿Eliminar este comentario?')) return;
    try {
      setDeletingId(commentId);
      await deleteExpenseComment(commentId, expenseId);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el comentario.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    setCommentText((prev) => prev + emoji);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleToggleReaction = async (commentId: string, emoji: string) => {
    if (!currentUser) return;
    await toggleCommentReaction(commentId, expenseId, emoji);
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {t('comments.title') || 'Comentarios'} ({comments.length})
          </h4>
        </div>
        <span className="text-[11px] text-slate-400">
          {t('comments.subtitle') || 'Conversa y reacciona sobre este gasto'}
        </span>
      </div>

      {/* Comments List */}
      <div className="space-y-3 max-h-64 overflow-y-auto overscroll-contain pr-1 -mr-1 custom-scrollbar">
        {comments.map((cmt) => {
          const isAuthor = currentUser?.id === cmt.user_id;
          const authorProfile = getAuthorProfile(cmt.user_id, cmt.profile);
          const reactions = cmt.reactions || {};
          const reactionEntries = Object.entries(reactions);

          return (
            <div
              key={cmt.id}
              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs transition-colors group space-y-2"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar
                    name={authorProfile.full_name}
                    avatarUrl={authorProfile.avatar_url}
                    size="sm"
                    className="shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-slate-100 truncate block text-xs">
                      {authorProfile.full_name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatDate(cmt.created_at, 'dd/MM/yyyy HH:mm')}
                  </span>

                  {isAuthor && (
                    <button
                      type="button"
                      onClick={() => handleDelete(cmt.id)}
                      disabled={deletingId === cmt.id}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-all"
                      title={t('common.delete') || 'Eliminar'}
                    >
                      {deletingId === cmt.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Text content */}
              {cmt.comment && (
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap pl-8">
                  {cmt.comment}
                </p>
              )}

              {/* Animated GIF content */}
              {cmt.gif_url && (
                <div className="pl-8 pt-1">
                  <div className="relative inline-block max-w-[240px] sm:max-w-[280px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cmt.gif_url}
                      alt="GIF animado"
                      className="w-full h-auto object-cover max-h-48"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}

              {/* Reactions Bar */}
              <div className="pl-8 pt-1 flex flex-wrap items-center gap-1.5">
                {reactionEntries.map(([emoji, users]) => {
                  const hasReacted = currentUser ? users.includes(currentUser.id) : false;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleToggleReaction(cmt.id, emoji)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-all select-none ${
                        hasReacted
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs scale-105'
                          : 'bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title={users.length > 0 ? `${users.length} reacción(es)` : ''}
                    >
                      <span className="text-sm leading-none">{emoji}</span>
                      <span className="text-[11px] font-bold">{users.length}</span>
                    </button>
                  );
                })}

                {/* Quick Add Reaction Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (reactingComment?.id === cmt.id) {
                      setReactingComment(null);
                    } else {
                      setReactingComment({ id: cmt.id, anchorEl: e.currentTarget });
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Añadir reacción"
                >
                  <Smile className="w-3 h-3 text-amber-500" />
                  <span>+</span>
                </button>
              </div>
            </div>
          );
        })}

        {comments.length === 0 && (
          <div className="py-6 text-center space-y-1 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <MessageSquare className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {t('comments.noComments') || 'Aún no hay comentarios en este gasto.'}
            </p>
            <p className="text-[11px] text-slate-400">
              ¡Sé el primero en comentar o reaccionar!
            </p>
          </div>
        )}
      </div>

      {/* Selected GIF Preview Banner */}
      {selectedGifUrl && (
        <div className="relative inline-flex items-center gap-2 p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 animate-in fade-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedGifUrl}
            alt="GIF adjunto"
            className="w-12 h-12 object-cover rounded-lg"
          />
          <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 pr-2">
            GIF adjunto listo para enviar
          </div>
          <button
            type="button"
            onClick={() => setSelectedGifUrl(null)}
            className="p-1 text-emerald-700 hover:text-rose-600 rounded-lg transition-colors"
            title="Quitar GIF"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Comment Input Composer */}
      {currentUser ? (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-2 relative">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSendComment();
                  }
                }}
                placeholder={t('comments.placeholder') || 'Escribe un comentario...'}
                maxLength={500}
                className="w-full pl-3 pr-20 py-2.5 text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              />

              {/* Inline input actions: Emoji & GIF */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {/* Emoji trigger */}
                <button
                  ref={emojiButtonRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEmojiPickerOpen(!isEmojiPickerOpen);
                  }}
                  className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Insertar emoticono"
                >
                  <Smile className="w-4 h-4" />
                </button>

                {/* GIF trigger */}
                <button
                  type="button"
                  onClick={() => setIsGifModalOpen(true)}
                  className="p-1.5 text-slate-400 hover:text-emerald-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Insertar GIF animado"
                >
                  <Film className="w-4 h-4" />
                </button>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleSendComment}
              size="sm"
              variant="brand"
              isLoading={isSubmitting}
              disabled={!commentText.trim() && !selectedGifUrl}
              className="text-xs font-bold gap-1.5 px-4 py-2.5 rounded-2xl shrink-0 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('comments.send') || 'Enviar'}</span>
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 text-center italic py-1">
          {t('comments.loginRequired') || 'Inicia sesión para participar en los comentarios.'}
        </p>
      )}

      {/* Portal Popover for quick comment reaction */}
      <EmojiPickerPopover
        isOpen={Boolean(reactingComment)}
        anchorEl={reactingComment?.anchorEl}
        onClose={() => setReactingComment(null)}
        onSelectEmoji={(emoji) => {
          if (reactingComment) {
            handleToggleReaction(reactingComment.id, emoji);
            setReactingComment(null);
          }
        }}
        position="auto"
      />

      {/* Portal Popover for composer emoji insert */}
      <EmojiPickerPopover
        isOpen={isEmojiPickerOpen}
        anchorEl={emojiButtonRef.current}
        onClose={() => setIsEmojiPickerOpen(false)}
        onSelectEmoji={handleInsertEmoji}
        position="top"
      />

      {/* GIF Picker Modal */}
      <GifPickerModal
        isOpen={isGifModalOpen}
        onClose={() => setIsGifModalOpen(false)}
        onSelectGif={(gifUrl) => {
          setSelectedGifUrl(gifUrl);
          setIsGifModalOpen(false);
        }}
      />
    </div>
  );
};
