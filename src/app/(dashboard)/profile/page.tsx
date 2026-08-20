'use client';

import React, { useState } from 'react';
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
import { Profile } from '@/types/database';
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
} from 'lucide-react';

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

  const [fullName, setFullName] = useState(currentUser.full_name);
  const [bizumPhone, setBizumPhone] = useState(currentUser.bizum_phone || '');
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await updateProfile({
      full_name: fullName.trim(),
      bizum_phone: bizumPhone.trim() || null,
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
    router.push('/login');
  };

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
          <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-slate-100 dark:border-slate-800">
            <Avatar profile={currentUser} size="xl" className="ring-4 ring-emerald-500/20" />

            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {currentUser.full_name}
                </h2>
                {isCurrentUserAdmin && (
                  <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                    Admin
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 block mt-0.5">{currentUser.email}</span>
              <Badge variant="emerald" size="sm" className="mt-2">
                <ShieldCheck className="w-3 h-3" />
                Cuenta Activa
              </Badge>
            </div>
          </div>

          {/* Edit Form */}
          <form onSubmit={handleSave} className="space-y-4 pt-6">
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
                {isSaved ? '¡Guardado!' : 'Guardar Cambios'}
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
