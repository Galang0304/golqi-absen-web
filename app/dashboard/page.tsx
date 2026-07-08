'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-collections';
import type { Absensi, Pengajuan } from '@/types';

interface DayStat {
  hari: string;
  hadir: number;
  terlambat: number;
  tidakHadir: number;
}

export default function DashboardPage() {
  const { userData } = useAuth();
  const [stats, setStats] = useState({
    totalKaryawan: 0,
    hadirHariIni: 0,
    terlambatHariIni: 0,
    tidakHadirHariIni: 0,
    pendingApproval: 0,
  });
  const [recentAbsensi, setRecentAbsensi] = useState<Absensi[]>([]);
  const [pendingPengajuan, setPendingPengajuan] = useState<Pengajuan[]>([]);
  const [weekData, setWeekData] = useState<DayStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time listeners on Firestore collections
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const unsubscribers: Array<() => void> = [];

    // Total karyawan (employees only)
    unsubscribers.push(
      onSnapshot(
        query(collection(db, COLLECTIONS.USERS), where('role', '==', 'karyawan')),
        (snap) => {
          setStats((prev) => ({ ...prev, totalKaryawan: snap.size }));
        },
        (err) => console.error('users listener error:', err)
      )
    );

    // Absensi hari ini (kehadiran real-time)
    unsubscribers.push(
      onSnapshot(
        query(
          collection(db, COLLECTIONS.ABSENSI),
          where('tanggal', '>=', Timestamp.fromDate(startOfDay)),
          where('tanggal', '<=', Timestamp.fromDate(endOfDay))
        ),
        (snap) => {
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Absensi[];
          const hadir = docs.filter((a) => a.status === 'hadir').length;
          const terlambat = docs.filter((a) => a.status === 'terlambat').length;
          const tidakHadir = docs.filter((a) => a.status === 'tidak_hadir').length;

          setStats((prev) => ({
            ...prev,
            hadirHariIni: hadir + terlambat,
            terlambatHariIni: terlambat,
            tidakHadirHariIni: tidakHadir,
          }));

          const sorted = [...docs].sort((a, b) => {
            const ta = a.clockIn?.toMillis?.() ?? a.tanggal?.toMillis?.() ?? 0;
            const tb = b.clockIn?.toMillis?.() ?? b.tanggal?.toMillis?.() ?? 0;
            return tb - ta;
          });
          setRecentAbsensi(sorted.slice(0, 5));
          setLoading(false);
        },
        (err) => {
          console.error('absensi listener error:', err);
          setLoading(false);
        }
      )
    );

    // Pengajuan pending (menunggu approval) — tanpa orderBy agar tidak butuh composite index
    unsubscribers.push(
      onSnapshot(
        query(
          collection(db, COLLECTIONS.PENGAJUAN),
          where('status', '==', 'pending')
        ),
        (snap) => {
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Pengajuan[];
          docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
          setPendingPengajuan(docs.slice(0, 5));
          setStats((prev) => ({ ...prev, pendingApproval: snap.size }));
        },
        (err) => console.error('pengajuan listener error:', err)
      )
    );

    // Absensi 7 hari terakhir (untuk grafik mingguan)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    unsubscribers.push(
      onSnapshot(
        query(
          collection(db, COLLECTIONS.ABSENSI),
          where('tanggal', '>=', Timestamp.fromDate(weekStart)),
          where('tanggal', '<=', Timestamp.fromDate(endOfDay))
        ),
        (snap) => {
          const days: DayStat[] = [];
          const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
          const buckets = new Map<string, DayStat>();
          // Kunci tanggal lokal (bukan UTC) agar cocok dengan zona waktu Indonesia.
          const localKey = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            const key = localKey(d);
            const ds: DayStat = { hari: dayNames[d.getDay()], hadir: 0, terlambat: 0, tidakHadir: 0 };
            buckets.set(key, ds);
            days.push(ds);
          }
          snap.docs.forEach((doc) => {
            const a = doc.data() as Absensi;
            const dt = a.tanggal?.toDate?.();
            const key = dt ? localKey(dt) : undefined;
            const ds = key ? buckets.get(key) : undefined;
            if (!ds) return;
            if (a.status === 'hadir') ds.hadir++;
            else if (a.status === 'terlambat') ds.terlambat++;
            else if (a.status === 'tidak_hadir') ds.tidakHadir++;
          });
          setWeekData(days);
        },
        (err) => console.error('week absensi listener error:', err)
      )
    );

    return () => unsubscribers.forEach((unsub) => unsub());
  }, []);

  const formatTime = (ts?: Timestamp) =>
    ts?.toDate?.().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) ?? '—';

  const statusLabel: Record<string, string> = {
    hadir: 'Hadir',
    terlambat: 'Terlambat',
    tidak_hadir: 'Tidak Hadir',
  };

  const jenisLabel: Record<string, string> = {
    cuti: 'Cuti',
    izin: 'Izin',
    sakit: 'Sakit',
  };

  const statCards = [
    {
      title: 'Total Karyawan',
      value: stats.totalKaryawan,
      change: 'Karyawan aktif',
      icon: (
        <svg className="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      glow: 'shadow-rose-500/5 hover:border-rose-200',
      bgColor: 'bg-rose-50/50',
      borderColor: 'border-slate-200/80',
    },
    {
      title: 'Hadir Hari Ini',
      value: stats.hadirHariIni,
      change:
        stats.totalKaryawan > 0
          ? `${Math.round((stats.hadirHariIni / stats.totalKaryawan) * 100)}% Kehadiran`
          : 'Belum ada data',
      icon: (
        <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      glow: 'shadow-emerald-500/5 hover:border-emerald-200',
      bgColor: 'bg-emerald-50/50',
      borderColor: 'border-slate-200/80',
    },
    {
      title: 'Terlambat Hari Ini',
      value: stats.terlambatHariIni,
      change: 'Butuh tindakan',
      icon: (
        <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      glow: 'shadow-amber-500/5 hover:border-amber-200',
      bgColor: 'bg-amber-50/50',
      borderColor: 'border-slate-200/80',
    },
    {
      title: 'Pending Approval',
      value: stats.pendingApproval,
      change: 'Pengajuan cuti/izin',
      icon: (
        <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      glow: 'shadow-indigo-500/5 hover:border-indigo-200',
      bgColor: 'bg-indigo-50/50',
      borderColor: 'border-slate-200/80',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Selamat datang kembali, <span className="font-semibold text-rose-500">{userData?.nama || 'User'}</span>. Berikut adalah ringkasan hari ini.
          </p>
        </div>
        
        {/* Quick Date Display */}
        <div className="flex items-center gap-2.5 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <span className="text-xs font-semibold text-slate-600">
            Sistem Aktif & Terkoneksi
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className={`glass-card rounded-2xl p-5 hover-lift ${stat.borderColor} ${stat.glow} transition-all duration-300`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {stat.title}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-800 tracking-tight">
                    {stat.value}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-400">
                  {stat.change}
                </p>
              </div>
              
              <div className={`${stat.bgColor} p-3 rounded-xl border border-slate-100`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly attendance bar chart */}
        <div className="glass-card rounded-2xl border border-slate-200/80 p-6 lg:col-span-2">
          <h2 className="text-base font-bold text-slate-800 mb-1">Kehadiran 7 Hari Terakhir</h2>
          <p className="text-xs text-slate-400 mb-4">Perbandingan hadir vs terlambat per hari</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="hari" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#fef2f2' }} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="hadir" name="Hadir" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="terlambat" name="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tidakHadir" name="Tidak Hadir" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Today composition donut */}
        <div className="glass-card rounded-2xl border border-slate-200/80 p-6">
          <h2 className="text-base font-bold text-slate-800 mb-1">Komposisi Hari Ini</h2>
          <p className="text-xs text-slate-400 mb-4">Status kehadiran</p>
          {stats.hadirHariIni + stats.tidakHadirHariIni === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">Belum ada data hari ini</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Hadir', value: stats.hadirHariIni - stats.terlambatHariIni },
                      { name: 'Terlambat', value: stats.terlambatHariIni },
                      { name: 'Tidak Hadir', value: stats.tidakHadirHariIni },
                    ].filter((d) => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {['#10b981', '#f59e0b', '#e11d48'].map((c, i) => (
                      <Cell key={i} fill={c} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Absensi Card */}
        <div className="glass-card rounded-2xl border border-slate-200/80 p-6 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-rose-50 text-rose-500 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Absensi Terbaru
              </h2>
            </div>
            <Link
              href="/dashboard/absensi"
              className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline transition"
            >
              Lihat Semua →
            </Link>
          </div>
          
          <div className="flex-1 flex flex-col">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-450">Menghubungkan Database...</p>
              </div>
            ) : recentAbsensi.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Belum Ada Absensi</p>
                  <p className="text-xs text-slate-450 mt-1">Belum ada karyawan yang melakukan absensi hari ini</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 mt-2">
                {recentAbsensi.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {a.userNama?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.userNama || 'Karyawan'}</p>
                      <p className="text-[11px] text-slate-400">Masuk {formatTime(a.clockIn)}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        a.status === 'hadir'
                          ? 'bg-emerald-50 text-emerald-600'
                          : a.status === 'terlambat'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {statusLabel[a.status] ?? a.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Pending Approvals Card */}
        <div className="glass-card rounded-2xl border border-slate-200/80 p-6 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <h2 className="text-base font-bold text-slate-800">
                Menunggu Approval
              </h2>
            </div>
            <Link
              href="/dashboard/pengajuan"
              className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline transition"
            >
              Lihat Semua →
            </Link>
          </div>
          
          <div className="flex-1 flex flex-col">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-450">Memuat pengajuan...</p>
              </div>
            ) : pendingPengajuan.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-slate-750">Belum Ada Pengajuan</p>
                  <p className="text-xs text-slate-450 mt-1">Daftar permohonan izin atau cuti karyawan yang butuh persetujuan Anda</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 mt-2">
                {pendingPengajuan.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {p.userNama?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{p.userNama || 'Karyawan'}</p>
                      <p className="text-[11px] text-slate-400 truncate">{jenisLabel[p.jenis] ?? p.jenis} • {p.alasan}</p>
                    </div>
                    <Link
                      href="/dashboard/pengajuan"
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                    >
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>

      {/* Quick Actions Panel */}
      <div className="glass-card rounded-2xl border border-slate-200/80 p-6">
        <h2 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
          <span className="p-1.5 bg-amber-50 text-amber-500 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          Aksi Cepat Admin
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <Link
            href="/dashboard/absensi"
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-slate-200/80 hover:border-rose-200 hover:bg-rose-50/30 transition-all duration-300 group"
          >
            <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-rose-50 group-hover:text-rose-500 text-slate-400 transition-colors duration-300 mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-slate-650 group-hover:text-slate-900 transition">
              Lihat Kehadiran
            </span>
          </Link>

          <Link
            href="/dashboard/pengajuan"
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-slate-200/80 hover:border-rose-200 hover:bg-rose-50/30 transition-all duration-300 group"
          >
            <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-rose-50 group-hover:text-rose-500 text-slate-400 transition-colors duration-300 mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-slate-650 group-hover:text-slate-900 transition">
              Kelola Pengajuan
            </span>
          </Link>

          <Link
            href="/dashboard/karyawan"
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-slate-200/80 hover:border-rose-200 hover:bg-rose-50/30 transition-all duration-300 group"
          >
            <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-rose-50 group-hover:text-rose-500 text-slate-400 transition-colors duration-300 mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-slate-650 group-hover:text-slate-900 transition">
              Manajemen Staff
            </span>
          </Link>

          <Link
            href="/dashboard/laporan"
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-slate-200/80 hover:border-rose-200 hover:bg-rose-50/30 transition-all duration-300 group"
          >
            <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-rose-50 group-hover:text-rose-500 text-slate-400 transition-colors duration-300 mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-slate-650 group-hover:text-slate-900 transition">
              Unduh Laporan
            </span>
          </Link>

        </div>
      </div>
    </div>
  );
}
