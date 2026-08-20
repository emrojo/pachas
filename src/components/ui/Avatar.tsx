'use client';

import React from 'react';
import { cn, getInitials, getAvatarColor } from '@/lib/utils';
import { Profile } from '@/types/database';

export interface AvatarProps {
  profile?: Profile | null;
  name?: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  profile,
  name,
  avatarUrl,
  size = 'md',
  className,
}) => {
  const displayName = profile?.full_name || name || 'Usuario';
  const url = profile?.avatar_url || avatarUrl;

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base font-semibold',
    xl: 'w-16 h-16 text-lg font-bold',
  };

  if (url) {
    return (
      <img
        src={url}
        alt={displayName}
        className={cn(
          'rounded-full object-cover border border-slate-200 dark:border-slate-800 shadow-sm shrink-0',
          sizeClasses[size],
          className
        )}
      />
    );
  }

  const colorClass = getAvatarColor(displayName);

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-medium shadow-sm shrink-0 uppercase tracking-tight select-none',
        sizeClasses[size],
        colorClass,
        className
      )}
    >
      {getInitials(displayName)}
    </div>
  );
};

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'emerald' | 'rose' | 'amber' | 'blue' | 'gray' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'gray',
  size = 'md',
  className,
}) => {
  const variantStyles = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
    purple: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800/50',
    gray: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border shadow-xs transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
};
