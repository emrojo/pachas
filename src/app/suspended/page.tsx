'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LogOut, Send, ShieldAlert, CheckCircle2, MessageSquare, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function SuspendedPage() {
  const {
    currentUser,
    isLoading,
    logout,
    supportMessages,
    sendSupportMessage,
    fetchSupportMessages,
    markSupportMessagesRead,
  } = usePachas();

  const router = useRouter();
  const { t } = useTranslation();

  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const checkLiveStatus = async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.user && !data.user.is_banned) {
          window.location.href = '/dashboard';
        }
      }
    } catch {}
  };

  // 1. Redirect if user is not banned or logged out
  useEffect(() => {
    if (!isLoading) {
      if (!currentUser) {
        router.replace('/')
      } else if (!currentUser.is_banned) {
        router.replace('/dashboard');
      }
    }
  }, [currentUser, isLoading, router]);

  // 2. Fetch and poll support messages & auto-check ban status
  useEffect(() => {
    if (currentUser?.is_banned) {
      fetchSupportMessages();
      markSupportMessagesRead();

      const interval = setInterval(() => {
        fetchSupportMessages();
        checkLiveStatus();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [currentUser?.is_banned]);

  // 3. Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [supportMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || isSending) return;

    const text = messageText.trim();
    setMessageText('');
    setIsSending(true);

    try {
      await sendSupportMessage(text, 'appeal');
      await fetchSupportMessages();
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error('Error sending appeal message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleManualStatusCheck = async () => {
    setIsCheckingStatus(true);
    try {
      await checkLiveStatus();
      await fetchSupportMessages();
    } catch {}
    setIsCheckingStatus(false);
  };

  if (isLoading || (!currentUser && !isLoading)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white text-2xl animate-pulse shadow-lg mb-4">
          🚫
        </div>
        <span className="text-xs font-semibold text-slate-400">Verificando estado de la cuenta...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-rose-500/30">
      {/* Top Bar Branding */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black shadow-md">
            💸
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
              Pachas <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">Moderación</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualStatusCheck}
            disabled={isCheckingStatus}
            className="text-xs font-semibold border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
            <span>Comprobar Estado</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => logout()}
            className="text-xs font-semibold border-rose-900/40 text-rose-300 hover:bg-rose-950/60 hover:text-rose-200"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            <span>Cerrar sesión</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 sm:py-8 space-y-6">
        
        {/* Banner de Suspensión */}
        <div className="bg-gradient-to-r from-rose-950/80 via-slate-900 to-slate-900 border border-rose-900/50 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 z-10 relative">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center text-3xl shrink-0 shadow-inner">
              🚫
            </div>

            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold px-2.5 py-0.5 rounded-full text-xs">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Cuenta Suspendida
                </span>
                {currentUser?.banned_at && (
                  <span className="text-xs text-slate-400">
                    Desde el {formatDate(currentUser.banned_at)}
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-white">
                Acceso restringido a la aplicación
              </h1>

              <div className="mt-2 p-3 bg-slate-950/80 rounded-xl border border-rose-950 text-xs sm:text-sm text-slate-300 space-y-1">
                <span className="font-bold text-rose-400 block">Motivo formal registrado por el Administrador:</span>
                <p className="italic leading-relaxed">
                  "{currentUser?.ban_reason || 'Infracción de las normas de convivencia o reporte bajo investigación.'}"
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chat de Apelación y Diálogo Directo con el Administrador */}
        <Card className="bg-slate-900/90 border-slate-800 shadow-2xl rounded-3xl overflow-hidden flex flex-col h-[520px]">
          
          {/* Cabecera del Chat */}
          <div className="p-4 sm:px-6 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  Canal de Diálogo y Apelación Oficial
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h2>
                <p className="text-[11px] text-slate-400">
                  Comunícate directamente con el administrador para solicitar aclaraciones o apelar tu suspensión.
                </p>
              </div>
            </div>

            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
              🛡️ Categoría: Apelación
            </span>
          </div>

          {/* Área de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {supportMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-400">
                  💬
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-sm font-bold text-slate-200">Inicia el diálogo con el Administrador</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Escribe tu mensaje a continuación para explicar lo sucedido, aportar pruebas o solicitar el levantamiento de la suspensión.
                  </p>
                </div>
              </div>
            ) : (
              supportMessages.map((msg) => {
                const isFromMe = msg.sender_role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isFromMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">
                        {isFromMe ? (currentUser?.full_name || 'Tú') : '👑 Administrador de Pachas'}
                      </span>
                      <span>•</span>
                      <span>{formatDate(msg.created_at)}</span>
                    </div>

                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-md ${
                        isFromMe
                          ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-xs'
                          : 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-tl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulario de Envío */}
          <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2">
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Escribe tu mensaje o aclaración al Administrador..."
              className="flex-1 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 text-xs sm:text-sm focus:border-indigo-500"
              disabled={isSending}
              maxLength={2000}
            />
            <Button
              type="submit"
              disabled={!messageText.trim() || isSending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 sm:px-5 shrink-0"
            >
              {isSending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Enviar</span>
                </>
              )}
            </Button>
          </form>
        </Card>
      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-900 px-4 py-4 text-center text-xs text-slate-500">
        Pachas • Plataforma Segura de Gastos Compartidos • Canal Oficial de Moderación y Apelaciones
      </footer>
    </div>
  );
}
