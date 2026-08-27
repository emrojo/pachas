'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { CreateUserModal } from '@/components/profile/CreateUserModal';
import { DonationCard } from '@/components/donations/DonationCard';
import { Profile } from '@/types/database';

import { validateAndCompressImage, sanitizeText } from '@/lib/security/sanitize';

import {
  User,
  Mail,
  Phone,
  LogOut,
  Save,
  Check,
  Sparkles,
  ShieldCheck,
  UserPlus,
  Trash2,
  Camera,
  Upload,
  Image as ImageIcon,
  X,
} from 'lucide-react';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80',
];

export default function ProfilePage() {
  const router = useRouter();
  const {
    currentUser,
    updateProfile,
    setCurrentUser,
    availableUsers,
    deleteLocalUser,
    isCurrentUserAdmin,
    isDemoMode,
    logout,
  } = usePachas();

  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [bizumPhone, setBizumPhone] = useState(currentUser?.bizum_phone || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUser?.avatar_url || null);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name);
      setBizumPhone(currentUser.bizum_phone || '');
      setAvatarUrl(currentUser.avatar_url || null);
    }
  }, [currentUser]);

  // Compress & read custom local photo securely
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const secureCompressed = await validateAndCompressImage(file, 300, 0.85);
      setAvatarUrl(secureCompressed);
    } catch (err: any) {
      alert(err.message || 'Error al procesar la imagen seleccionada.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsLoading(true);
    await updateProfile({
      full_name: sanitizeText(fullName, 100),
      bizum_phone: sanitizeText(bizumPhone, 25) || null,
      avatar_url: avatarUrl || null,
    });
    setIsLoading(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };


  const handleSwitchUser = (user: Profile) => {
    if (!isDemoMode) return;
    setCurrentUser(user);
    setFullName(user.full_name);
    setBizumPhone(user.bizum_phone || '');
    setAvatarUrl(user.avatar_url || null);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleDeleteUser = async (e: React.MouseEvent, user: Profile) => {
    e.stopPropagation();
    if (!isCurrentUserAdmin) {
      alert('Solo los administradores pueden eliminar usuarios de prueba.');
      return;
    }
    if (confirm(`¿Eliminar el usuario "${user.full_name}"?`)) {
      await deleteLocalUser(user.id);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  if (!currentUser) return null;


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-12">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Mi Perfil & Ajustes
          </h1>

          {isCurrentUserAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCreateUserOpen(true)}
              className="gap-1.5 text-xs"
            >
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span>+ Crear Usuario</span>
            </Button>
          )}
        </div>

        {/* Profile Card */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
            {/* Avatar & Photo Upload Trigger */}
            <div className="relative group shrink-0">
              <Avatar
                profile={{ ...currentUser, full_name: fullName, avatar_url: avatarUrl }}
                size="xl"
                className="w-20 h-20 text-2xl ring-4 ring-emerald-500/20 shadow-md"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/45 text-white flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs shadow-inner cursor-pointer"
                title="Cambiar foto de perfil"
              >
                <Camera className="w-5 h-5 text-white drop-shadow" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-white">Cambiar</span>
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            <div className="text-center sm:text-left flex-1 min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                  {fullName || currentUser.full_name}
                </h2>
                {isCurrentUserAdmin && (
                  <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 shrink-0">
                    Admin
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 block mt-0.5 truncate">{currentUser.email}</span>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                <Badge variant="emerald" size="sm">
                  <ShieldCheck className="w-3 h-3" />
                  Cuenta Activa
                </Badge>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1"
                    title="Quitar foto y usar iniciales"
                  >
                    <X className="w-3 h-3" />
                    Quitar foto
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Photo Selection Tools */}
          <div className="py-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Foto de Perfil
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Subir foto desde tu dispositivo
              </button>
            </div>

            {/* Presets Row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                  !avatarUrl
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                    : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title="Sin foto (Iniciales)"
              >
                ABC
              </button>

              {AVATAR_PRESETS.map((url, idx) => {
                const isSelected = avatarUrl === url;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/40 scale-105'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Edit Form */}
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            <Input
              label="Nombre Completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              required
            />

            <Input
              label="Correo Electrónico (No editable)"
              value={currentUser.email}
              disabled
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <div>
              <Input
                label="Teléfono para Bizum"
                placeholder="+34 600 000 000"
                value={bizumPhone}
                onChange={(e) => setBizumPhone(e.target.value)}
                leftIcon={<Phone className="w-4 h-4" />}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Tus amigos podrán ver este número para saldar deudas directamente por Bizum.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button type="submit" variant="brand" isLoading={isLoading} className="gap-1.5">
                {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {isSaved ? '¡Guardado con Éxito!' : 'Guardar Cambios'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleLogout}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                Cerrar Sesión
              </Button>
            </div>
          </form>
        </Card>

        {/* Buy Me a Coffee Support Card */}
        <DonationCard />

        {/* Demo Fast User Switcher & Local Testing Users (Only visible in Demo / Development Mode) */}
        {isDemoMode && (

          <Card className="p-6 bg-slate-50/80 dark:bg-slate-900/80">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Simulación y Usuarios de Prueba ({availableUsers.length})
                </h3>
              </div>

              {isCurrentUserAdmin && (
                <Button
                  size="sm"
                  variant="brand"
                  onClick={() => setIsCreateUserOpen(true)}
                  className="text-xs gap-1.5 h-8"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Nuevo Usuario</span>
                </Button>
              )}
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Cambia de sesión con un clic para simular la aplicación desde la perspectiva de cualquier amigo o crea nuevos perfiles ficticios:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {availableUsers.map((u) => {
                const isCurrent = u.id === currentUser.id;
                const isCustom = u.id.startsWith('user-custom-');

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSwitchUser(u)}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all relative group ${
                      isCurrent
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/40 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar profile={u} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                            {u.full_name}
                          </span>
                          {isCustom && (
                            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              Creado
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate">{u.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isCurrent && (
                        <Badge variant="emerald" size="sm">
                          Activo
                        </Badge>
                      )}

                      {isCustom && !isCurrent && isCurrentUserAdmin && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteUser(e, u)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Eliminar este usuario de prueba"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        )}
      </main>

      <BottomNav />

      <CreateUserModal
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        onSuccess={(newUser) => {
          handleSwitchUser(newUser);
        }}
      />
    </div>
  );
}
