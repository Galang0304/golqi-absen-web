'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, ReactNode } from 'react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type NavLink = { name: string; href: string; icon: ReactNode };
type NavGroup = { name: string; icon: ReactNode; items: NavLink[] };
type NavEntry = { type: 'link'; link: NavLink } | { type: 'group'; group: NavGroup };

const icon = (d: string) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

const NAV: NavEntry[] = [
  {
    type: 'link',
    link: { name: 'Dashboard', href: '/dashboard', icon: icon('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6') },
  },
  {
    type: 'link',
    link: { name: 'Absensi', href: '/dashboard/absensi', icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01') },
  },
  {
    type: 'link',
    link: { name: 'Pengajuan Cuti/Izin', href: '/dashboard/pengajuan', icon: icon('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z') },
  },
  {
    type: 'group',
    group: {
      name: 'Manajemen SDM',
      icon: icon('M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'),
      items: [
        { name: 'Karyawan', href: '/dashboard/karyawan', icon: icon('M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z') },
        { name: 'Leader', href: '/dashboard/leader', icon: icon('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z') },
        { name: 'Jabatan / Role', href: '/dashboard/jabatan', icon: icon('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z') },
      ],
    },
  },
  {
    type: 'group',
    group: {
      name: 'Operasional',
      icon: icon('M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'),
      items: [
        { name: 'Cabang / Outlet', href: '/dashboard/cabang', icon: icon('M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4') },
        { name: 'Shift Kerja', href: '/dashboard/shift', icon: icon('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z') },
      ],
    },
  },
  {
    type: 'group',
    group: {
      name: 'Keuangan & Laporan',
      icon: icon('M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'),
      items: [
        { name: 'Tunjangan', href: '/dashboard/tunjangan', icon: icon('M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z') },
        { name: 'Penggajian', href: '/dashboard/penggajian', icon: icon('M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z') },
        { name: 'Laporan Kehadiran', href: '/dashboard/laporan', icon: icon('M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z') },
      ],
    },
  },
  {
    type: 'group',
    group: {
      name: 'Penilaian Kinerja',
      icon: icon('M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'),
      items: [
        { name: 'Surat Peringatan', href: '/dashboard/sp', icon: icon('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z') },
        { name: 'Reward', href: '/dashboard/reward', icon: icon('M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z') },
      ],
    },
  },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href));
  const groupActive = (g: NavGroup) => g.items.some((it) => isActive(it.href));

  // Buka grup yang sedang aktif secara otomatis.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const entry of NAV) {
        if (entry.type === 'group' && groupActive(entry.group)) next[entry.group.name] = true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggle = (name: string) => setOpen((p) => ({ ...p, [name]: !p[name] }));

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/30 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-rose-600 via-rose-700 to-rose-800 transform transition-transform duration-300 ease-in-out flex flex-col shadow-xl
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 p-1 bg-white rounded-xl flex-shrink-0">
              <img
                src="https://res.cloudinary.com/xuqxnb0o/image/upload/f_auto,q_auto,w_80/golqi-absensi/golqi-logo"
                alt="Golqi Chicken"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = '/golqi.png';
                }}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white leading-tight">Golqi Absensi</span>
              <span className="text-[10px] text-rose-200 uppercase tracking-wider font-semibold">HRD Dashboard</span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Tutup menu"
            className="lg:hidden p-2 rounded-xl hover:bg-white/10 text-rose-100 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-4 space-y-1 overflow-y-auto">
          {NAV.map((entry) => {
            if (entry.type === 'link') {
              const active = isActive(entry.link.href);
              return (
                <Link
                  key={entry.link.name}
                  href={entry.link.href}
                  onClick={onClose}
                  className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                    active ? 'bg-white text-rose-700 font-semibold shadow-sm' : 'text-rose-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className={active ? 'text-rose-600' : 'text-rose-200 group-hover:text-white'}>{entry.link.icon}</span>
                  <span>{entry.link.name}</span>
                </Link>
              );
            }

            const g = entry.group;
            const expanded = open[g.name] ?? false;
            const hasActive = groupActive(g);
            return (
              <div key={g.name}>
                <button
                  onClick={() => toggle(g.name)}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                    hasActive && !expanded ? 'bg-white/10 text-white' : 'text-rose-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-rose-200 group-hover:text-white">{g.icon}</span>
                  <span className="flex-1 text-left">{g.name}</span>
                  <svg
                    className={`w-4 h-4 text-rose-200 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Submenu */}
                <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-96 mt-1' : 'max-h-0'}`}>
                  <div className="ml-3 pl-3 border-l border-white/15 space-y-1">
                    {g.items.map((it) => {
                      const active = isActive(it.href);
                      return (
                        <Link
                          key={it.name}
                          href={it.href}
                          onClick={onClose}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 group ${
                            active ? 'bg-white text-rose-700 font-semibold shadow-sm' : 'text-rose-100/90 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className={active ? 'text-rose-600' : 'text-rose-200 group-hover:text-white'}>{it.icon}</span>
                          <span>{it.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 mt-auto">
          <p className="text-[10px] text-rose-200 text-center font-medium">Sistem Absensi Golqi • v1.1.0</p>
        </div>
      </div>
    </>
  );
}
