'use client';

import React, { useState, useEffect } from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { MessageSquare, Send, Trash2, Loader2, Sparkles } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export interface ExpenseCommentsSectionProps {
  expenseId: string;
  expenseTitle?: string;
}

export const ExpenseCommentsSection: React.FC<ExpenseCommentsSectionProps> = ({
  expenseId,
  expenseTitle,
}) => {
  const {
    currentUser,
    getExpenseComments,
    addExpenseComment,
    deleteExpenseComment,
    fetchExpenseComments,
  } = usePachas();
  const { t } = useTranslation();

  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const comments = getExpenseComments(expenseId);

  // Fetch comments from backend on mount
  useEffect(() => {
    if (expenseId) {
      fetchExpenseComments(expenseId);
    }
  }, [expenseId]);

  const handleSendComment = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!commentText.trim() || isSubmitting || !currentUser) return;

    try {
      setIsSubmitting(true);
      await addExpenseComment(expenseId, commentText.trim());
      setCommentText('');
    } catch (err: any) {
      alert(err.message || 'Error al enviar el comentario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm(t('comments.confirmDelete'))) return;
    try {
      setDeletingId(commentId);
      await deleteExpenseComment(commentId, expenseId);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el comentario.');
    } finally {
      setDeletingId(null);
    }
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
            {t('comments.title')} ({comments.length})
          </h4>
        </div>
        <span className="text-[11px] text-slate-400">
          {t('comments.subtitle')}
        </span>
      </div>

      {/* Comments List */}
      <div className="space-y-2.5 max-h-48 overflow-y-auto overscroll-contain pr-1 -mr-1">
        {comments.map((cmt) => {
          const isAuthor = currentUser?.id === cmt.user_id;
          const authorProfile = cmt.profile || {
            id: cmt.user_id,
            email: '',
            full_name: 'Amigo',
            avatar_url: null,
          };

          return (
            <div
              key={cmt.id}
              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs transition-colors group"
            >
              <Avatar
                name={authorProfile.full_name}
                avatarUrl={authorProfile.avatar_url}
                size="sm"
                className="shrink-0 mt-0.5"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    {authorProfile.full_name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {formatDate(cmt.created_at, 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>

                <p className="text-slate-700 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
                  {cmt.comment}
                </p>
              </div>

              {isAuthor && (
                <button
                  type="button"
                  onClick={() => handleDelete(cmt.id)}
                  disabled={deletingId === cmt.id}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-all shrink-0"
                  title={t('common.delete')}
                >
                  {deletingId === cmt.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          );
        })}

        {comments.length === 0 && (
          <div className="py-4 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            {t('comments.noComments')}
          </div>
        )}
      </div>

      {/* Add Comment Input */}
      {currentUser ? (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleSendComment();
              }
            }}
            placeholder={t('comments.placeholder')}
            maxLength={500}
            className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          />
          <Button
            type="button"
            onClick={handleSendComment}
            size="sm"
            variant="brand"
            isLoading={isSubmitting}
            disabled={!commentText.trim()}
            className="text-xs font-bold gap-1 px-3 py-2 shrink-0 shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('comments.send')}</span>
          </Button>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 text-center italic">
          {t('comments.loginRequired')}
        </p>
      )}
    </div>
  );
};
