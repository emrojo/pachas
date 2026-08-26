'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
import { Avatar } from '@/components/ui/Avatar';
import { Plus, Users, User, Compass, Sparkles, ChevronDown, UserPlus, Check, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CreateUserModal } from '@/components/profile/CreateUserModal';
import { Profile } from '@/types/database';

export interface NavbarProps {
  onCreateGroupClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onCreateGroupClick }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, availableUsers, setCurrentUser, isCurrentUserAdmin, isDemoMode, logout } = usePachas();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (user: Profile) => {
    setCurrentUser(user);
    setIsDropdownOpen(false);
  };

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await logout();
    router.push('/login');
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xl font-black shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              💸
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Pachas
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  Vacaciones
                </span>
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <Link
              href="/dashboard"
              className={`transition-colors hover:text-emerald-600 dark:hover:text-emerald-400 ${
                pathname === '/dashboard' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''
              }`}
            >
              Mis Grupos
            </Link>
            <Link
              href="/profile"
              className={`transition-colors hover:text-emerald-600 dark:hover:text-emerald-400 ${
                pathname === '/profile' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''
              }`}
            >
              Mi Perfil
            </Link>
          </nav>

          {/* Action Button & User Dropdown */}
          <div className="flex items-center gap-2 sm:gap-3">
            {onCreateGroupClick && (
              <Button
                size="sm"
                variant="brand"
                onClick={onCreateGroupClick}
                className="hidden sm:inline-flex shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Nuevo Grupo
              </Button>
            )}

            {/* User Menu Trigger */}
            {currentUser ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-left"
                  title={isDemoMode ? 'Cambiar de usuario (Simulación local)' : 'Menú de usuario'}
                >
                  <Avatar profile={currentUser} size="sm" className="w-7 h-7 text-xs" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 hidden sm:inline max-w-[90px] truncate">
                    {currentUser.full_name ? currentUser.full_name.split(' ')[0] : 'Usuario'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                    {/* User info banner */}
                    <div className="px-2.5 py-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                          {currentUser.full_name}
                        </span>
                        {isCurrentUserAdmin && (
                          <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                            Admin
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 truncate block">{currentUser.email}</span>
                    </div>

                    {/* Demo Mode Quick Switcher */}
                    {isDemoMode && (
                      <>
                        <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            Simular usuario:
                          </span>
                          <span>{availableUsers.length}</span>
                        </div>

                        <div className="max-h-40 overflow-y-auto py-1 space-y-0.5 no-scrollbar">
                          {availableUsers.map((u) => {
                            const isCurrent = u.id === currentUser.id;
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => handleSelectUser(u)}
                                className={`w-full flex items-center justify-between p-1.5 rounded-xl text-left transition-colors text-xs ${
                                  isCurrent
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Avatar profile={u} size="sm" className="w-6 h-6 text-[10px]" />
                                  <span className="truncate">{u.full_name}</span>
                                </div>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Menu actions */}
                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
                      {isCurrentUserAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            setIsCreateUserOpen(true);
                          }}
                          className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>+ Crear Usuario</span>
                        </button>
                      )}

                      <Link
                        href="/profile"
                        onClick={() => setIsDropdownOpen(false)}
                        className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Mi Perfil & Ajustes</span>
                      </Link>

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login">
                <Button size="sm" variant="brand">
                  Iniciar Sesión
                </Button>
              </Link>
            )}

          </div>
        </div>
      </header>

      <CreateUserModal
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        onSuccess={(created) => {
          setCurrentUser(created);
        }}
      />
    </>
  );
};
