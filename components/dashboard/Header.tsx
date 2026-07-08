'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { userData, signOut } = useAuth();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Get current date and time
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all duration-300">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        
        {/* Left side: Mobile Brand Logo / Desktop Date */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Open Side Drawer Button (for fallback) */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition duration-200"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Mobile Brand Title */}
          <div className="flex lg:hidden items-center gap-2">
            <img
              src="https://res.cloudinary.com/xuqxnb0o/image/upload/f_auto,q_auto,w_80/golqi-absensi/golqi-logo"
              alt="Golqi Logo"
              className="w-8 h-8 object-contain"
              onError={(e) => {
                e.currentTarget.src = '/golqi.png';
              }}
            />
            <span className="text-sm font-bold bg-gradient-to-r from-rose-500 to-rose-600 bg-clip-text text-transparent">
              Golqi HRD
            </span>
          </div>

          {/* Desktop Formatted Date */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-medium text-slate-600">{dateStr}</span>
          </div>
        </div>

        {/* Right side: User menu */}
        <div className="flex items-center gap-3">

          {/* User profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-50 transition-all duration-200 group"
            >
              {/* User Avatar with online indicator */}
              <div className="relative w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
                {userData?.fotoProfile ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userData.fotoProfile} alt={userData.nama || 'User'} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-rose-600 font-bold text-xs">
                    {userData?.nama?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
              </div>

              {/* User Name (Hidden on Mobile) */}
              <div className="hidden md:block text-left max-w-[120px]">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {userData?.nama || 'User'}
                </p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  {userData?.role || 'admin'}
                </p>
              </div>

              <svg
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu Overlay */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2.5 w-56 origin-top-right rounded-2xl bg-white shadow-xl border border-slate-200/80 py-1.5 focus:outline-none z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                
                {/* Header User info details */}
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                  {userData?.fotoProfile ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={userData.fotoProfile} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-slate-200" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 font-bold flex items-center justify-center flex-shrink-0">
                      {userData?.nama?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Masuk sebagai</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5 truncate">
                      {userData?.nama || 'User'}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {userData?.email || ''}
                    </p>
                  </div>
                </div>

                {/* Profile Link */}
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    router.push('/dashboard/profile');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition duration-150"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profil Saya
                </button>

                {/* Logout Button */}
                <div className="border-t border-slate-100 mt-1.5 pt-1.5">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition duration-150"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Keluar Aplikasi
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}

