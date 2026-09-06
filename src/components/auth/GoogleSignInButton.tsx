'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/context/LanguageContext';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onSuccess: (user: any) => void;
  onError?: (error: string) => void;
  context?: 'signin' | 'signup';
}

/**
 * GoogleSignInButton — Renders a "Continue with Google" button using
 * a custom-styled button that triggers the Google Identity Services popup.
 *
 * Falls back gracefully: if NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set,
 * renders nothing.
 */
export function GoogleSignInButton({ onSuccess, onError, context = 'signin' }: GoogleSignInButtonProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const scriptLoaded = useRef(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || scriptLoaded.current) return;

    // Load the Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded.current = true;

      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        setIsReady(true);
      }
    };
    script.onerror = () => {
      console.warn('[GoogleSignIn] Failed to load Google Identity Services script');
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup: don't remove the script since it may be used by other components
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleCredentialResponse = async (response: { credential: string }) => {
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json();

      if (res.ok && data.user) {
        onSuccess(data.user);
      } else {
        const errorMsg = data.error || t('auth.googleLoginError');
        onError?.(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || t('auth.googleLoginError');
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    if (!isReady || !window.google?.accounts?.id) return;

    // Trigger the Google One Tap / popup flow
    window.google.accounts.id.prompt();
  };

  // Don't render if Google Client ID is not configured
  if (!clientId) return null;

  return (
    <div className="w-full">
      {/* Divider */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-700" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white dark:bg-slate-900 px-3 text-[11px] uppercase font-bold tracking-wider text-slate-400">
            {t('auth.orContinueWith')}
          </span>
        </div>
      </div>

      {/* Google Sign-In Button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading || !isReady}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
      >
        {isLoading ? (
          <div className="w-5 h-5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        <span>{t('auth.continueWithGoogle')}</span>
      </button>
    </div>
  );
}
