'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-collections';
import DateRangeFilter, { DateRange } from '@/components/dashboard/DateRangeFilter';
import type { Absensi } from '@/types';

interface Rekap {
  nama: string;
  jabatan: string;
  cabang: string;
  hadir: number;
  terlambat: number;
  tidakHadir: number;
  alfa: number;
  off: number;
  total: number;
  label: 'reward' | 'sp' | 'normal';
}

interface KaryawanJadwal {
  id: string;
  nama: string;
  cabang: string;
  jabatan: string;
  jadwalKerja: string[];
  status: string;
  joinDate: Date | null;
}

// Kriteria penilaian (per rentang tanggal)
const SP_TERLAMBAT_MIN = 3; // >= 3x terlambat => kandidat SP
const SP_TIDAK_HADIR_MIN = 2; // >= 2x tidak hadir => kandidat SP

function evalLabel(r: { hadir: number; terlambat: number; tidakHadir: number; alfa: number; total: number }): 'reward' | 'sp' | 'normal' {
  if (r.tidakHadir >= SP_TIDAK_HADIR_MIN || r.terlambat >= SP_TERLAMBAT_MIN || r.alfa >= SP_TIDAK_HADIR_MIN) return 'sp';
  if (r.total > 0 && r.terlambat === 0 && r.tidakHadir === 0 && r.alfa === 0) return 'reward';
  return 'normal';
}

function monthRange(): DateRange {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

export default function LaporanPage() {
  const [records, setRecords] = useState<Absensi[]>([]);
  const [karyawanAll, setKaryawanAll] = useState<KaryawanJadwal[]>([]);
  const [outletNames, setOutletNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>(monthRange());
  const [searchTerm, setSearchTerm] = useState('');
  const [labelFilter, setLabelFilter] = useState<'semua' | 'reward' | 'sp' | 'alfa'>('semua');
  const [outletFilter, setOutletFilter] = useState<string>('semua');

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      query(
        collection(db, COLLECTIONS.ABSENSI),
        where('tanggal', '>=', Timestamp.fromDate(range.start)),
        where('tanggal', '<=', Timestamp.fromDate(range.end))
      ),
      (snap) => {
        setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Absensi));
        setLoading(false);
      },
      (err) => {
        console.error('laporan listener error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [range]);

  // Load karyawan & leader (untuk perhitungan alfa & outlet)
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where('role', 'in', ['karyawan', 'leader'])),
      (snap) => {
        setKaryawanAll(
          snap.docs.map((d) => {
            const u = d.data() as { nama?: string; cabang?: string; jabatan?: string; role?: string; jadwalKerja?: string[]; status?: string; createdAt?: Timestamp };
            return {
              id: d.id,
              nama: u.nama || 'Tanpa Nama',
              cabang: u.cabang || '—',
              jabatan: u.role === 'leader' ? 'Leader' : (u.jabatan || '—'),
              jadwalKerja: Array.isArray(u.jadwalKerja) ? u.jadwalKerja : [],
              status: u.status || 'Aktif',
              joinDate: u.createdAt?.toDate?.() ?? null,
            };
          })
        );
      },
      (err) => console.error('karyawan listener error:', err)
    );
    return () => unsub();
  }, []);

  // Load master outlet untuk opsi filter (semua outlet, walau belum ada karyawan)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, COLLECTIONS.OUTLETS),
      (snap) => {
        setOutletNames(snap.docs.map((d) => (d.data() as { nama?: string }).nama || '').filter(Boolean));
      },
      (err) => console.error('outlet listener error:', err)
    );
    return () => unsub();
  }, []);

  const rekap = useMemo<Rekap[]>(() => {
    const map = new Map<string, Rekap>();

    // Lookup nama -> cabang dari data karyawan
    const namaCabang = new Map<string, string>();
    for (const k of karyawanAll) namaCabang.set(k.nama, k.cabang);

    // Count attendance records
    for (const r of records) {
      const nama = r.userNama || 'Tanpa Nama';
      const cur = map.get(nama) || { nama, jabatan: '—', cabang: namaCabang.get(nama) || '—', hadir: 0, terlambat: 0, tidakHadir: 0, alfa: 0, off: 0, total: 0, label: 'normal' as const };
      if (r.status === 'hadir') cur.hadir++;
      else if (r.status === 'terlambat') cur.terlambat++;
      else if (r.status === 'tidak_hadir') cur.tidakHadir++;
      cur.total++;
      map.set(nama, cur);
    }

    // Count alfa & off: days karyawan should/shouldn't work
    const HARI_MAP: Record<number, string> = { 0: 'Minggu', 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu' };
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const endDate = range.end < today ? range.end : today;

    for (const k of karyawanAll) {
      if (k.status !== 'Aktif' || k.jadwalKerja.length === 0) continue;

      const cur = map.get(k.nama) || { nama: k.nama, jabatan: '—', cabang: '—', hadir: 0, terlambat: 0, tidakHadir: 0, alfa: 0, off: 0, total: 0, label: 'normal' as const };
      cur.jabatan = k.jabatan;
      cur.cabang = k.cabang;
      let scheduledDays = 0;
      let totalDays = 0;
      // Mulai hitung dari max(range.start, tanggal join karyawan) supaya tidak dihitung alfa sebelum dia masuk
      const effectiveStart = k.joinDate && k.joinDate > range.start ? new Date(k.joinDate) : new Date(range.start);
      effectiveStart.setHours(0, 0, 0, 0);
      const d = new Date(effectiveStart);
      while (d <= endDate) {
        totalDays++;
        const dayName = HARI_MAP[d.getDay()];
        if (k.jadwalKerja.includes(dayName)) scheduledDays++;
        d.setDate(d.getDate() + 1);
      }
      const recordedDays = cur.hadir + cur.terlambat + cur.tidakHadir;
      cur.alfa = Math.max(0, scheduledDays - recordedDays);
      cur.off = totalDays - scheduledDays;
      map.set(k.nama, cur);
    }

    const list = Array.from(map.values());
    list.forEach((r) => (r.label = evalLabel(r)));
    return list.sort((a, b) => a.nama.localeCompare(b.nama));
  }, [records, karyawanAll, range]);

  const filteredRekap = useMemo(
    () =>
      rekap.filter((r) => {
        const matchSearch = r.nama.toLowerCase().includes(searchTerm.toLowerCase());
        const matchLabel =
          labelFilter === 'semua' ||
          (labelFilter === 'alfa' ? r.alfa > 0 : r.label === labelFilter);
        const matchOutlet = outletFilter === 'semua' || r.cabang === outletFilter;
        return matchSearch && matchLabel && matchOutlet;
      }),
    [rekap, searchTerm, labelFilter, outletFilter]
  );

  const outletOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of outletNames) if (o) set.add(o);
    for (const k of karyawanAll) if (k.cabang && k.cabang !== '—') set.add(k.cabang);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [outletNames, karyawanAll]);

  const totals = useMemo(
    () => ({
      hadir: records.filter((r) => r.status === 'hadir').length,
      terlambat: records.filter((r) => r.status === 'terlambat').length,
      tidakHadir: records.filter((r) => r.status === 'tidak_hadir').length,
    }),
    [records]
  );

  const rangeLabel = useMemo(() => {
    const f = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return range.start.toDateString() === range.end.toDateString() ? f(range.start) : `${f(range.start)} - ${f(range.end)}`;
  }, [range]);

  const handleExport = () => {
    const labelText = (l: Rekap['label']) => (l === 'reward' ? 'Kandidat Reward' : l === 'sp' ? 'Kandidat SP' : 'Normal');
    const header = ['Nama', 'Jabatan', 'Outlet', 'Hadir', 'Terlambat', 'Tidak Hadir', 'Alfa', 'Off/Libur', 'Total Record', 'Penilaian'];
    const rows = filteredRekap.map((r) => [r.nama, r.jabatan, r.cabang, r.hadir, r.terlambat, r.tidakHadir, r.alfa, r.off, r.total, labelText(r.label)]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-kehadiran-${rangeLabel.replace(/ /g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const rewardCount = useMemo(() => rekap.filter((r) => r.label === 'reward').length, [rekap]);
  const spCount = useMemo(() => rekap.filter((r) => r.label === 'sp').length, [rekap]);
  const alfaTotal = useMemo(() => rekap.reduce((s, r) => s + r.alfa, 0), [rekap]);

  const summaryCards = [
    { label: 'Total Hadir', value: totals.hadir, color: 'text-emerald-600' },
    { label: 'Total Alfa', value: alfaTotal, color: 'text-rose-600' },
    { label: 'Kandidat Reward', value: rewardCount, color: 'text-emerald-600' },
    { label: 'Kandidat SP', value: spCount, color: 'text-rose-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Laporan Kehadiran</h1>
          <p className="text-sm text-slate-500 mt-1">Rekap kehadiran karyawan per bulan.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter value={range} onChange={setRange} />
          <button
            onClick={handleExport}
            disabled={rekap.length === 0}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition shadow-sm shadow-rose-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((c) => (
          <div key={c.label} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{c.label}</p>
            <p className={`text-3xl font-extrabold mt-2 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
          {([
            { key: 'semua', label: 'Semua' },
            { key: 'alfa', label: 'Ada Alfa' },
            { key: 'reward', label: 'Kandidat Reward' },
            { key: 'sp', label: 'Kandidat SP' },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setLabelFilter(t.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                labelFilter === t.key ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 md:w-auto">
          <div className="relative sm:w-48">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m2-14h14M9 7v14m6-14v14" />
              </svg>
            </span>
            <select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              title="Filter outlet"
              aria-label="Filter outlet"
              className="w-full pl-9 pr-8 py-2.5 text-xs text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition appearance-none cursor-pointer"
            >
              <option value="semua">Semua Outlet</option>
              {outletOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="relative sm:w-72">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              placeholder="Cari nama karyawan..."
            />
          </div>
        </div>
      </div>

      {/* Criteria legend */}
      <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold">Reward</span>
          tanpa terlambat, tanpa tidak hadir & tanpa alfa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 font-bold">SP</span>
          terlambat ≥ {SP_TERLAMBAT_MIN}x atau alfa/tidak hadir ≥ {SP_TIDAK_HADIR_MIN}x
        </span>
        <span className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-bold">Alfa</span>
          hari terjadwal tanpa absensi (berdasarkan jadwal kerja)
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Karyawan</th>
                <th className="px-6 py-4">Jabatan</th>
                <th className="px-6 py-4">Outlet</th>
                <th className="px-6 py-4 text-center">Hadir</th>
                <th className="px-6 py-4 text-center">Terlambat</th>
                <th className="px-6 py-4 text-center">Tidak Hadir</th>
                <th className="px-6 py-4 text-center">Alfa</th>
                <th className="px-6 py-4 text-center">Off</th>
                <th className="px-6 py-4 text-center">Total</th>
                <th className="px-6 py-4 text-center">Penilaian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Memuat laporan...
                  </td>
                </tr>
              ) : filteredRekap.length > 0 ? (
                filteredRekap.map((r) => (
                  <tr key={r.nama} className="hover:bg-slate-50/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-xl flex items-center justify-center">
                          {r.nama.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-semibold text-slate-800">{r.nama}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {r.jabatan && r.jabatan !== '—' ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-600 whitespace-nowrap">{r.jabatan}</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {r.cabang && r.cabang !== '—' ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-sky-50 text-sky-600 whitespace-nowrap">{r.cabang}</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-emerald-600">{r.hadir}</td>
                    <td className="px-6 py-4 text-center font-bold text-amber-600">{r.terlambat}</td>
                    <td className="px-6 py-4 text-center font-bold text-rose-600">{r.tidakHadir}</td>
                    <td className="px-6 py-4 text-center font-bold text-orange-600">{r.alfa > 0 ? r.alfa : '—'}</td>
                    <td className="px-6 py-4 text-center font-medium text-slate-500">{r.off > 0 ? r.off : '—'}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700">{r.total}</td>
                    <td className="px-6 py-4 text-center">
                      {r.label === 'reward' ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600 inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                          Reward
                        </span>
                      ) : r.label === 'sp' ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-600 inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          SP
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                    <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {rekap.length === 0 ? `Belum ada data kehadiran pada ${rangeLabel}.` : 'Tidak ada karyawan yang cocok dengan filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Card list (mobile) */}
        <div className="lg:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="px-4 py-12 text-center text-slate-400">
              <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Memuat laporan...
            </div>
          ) : filteredRekap.length > 0 ? (
            filteredRekap.map((r) => (
              <div key={r.nama} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-xl flex items-center justify-center flex-shrink-0">
                      {r.nama.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{r.nama}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {r.jabatan && r.jabatan !== '—' && <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-600">{r.jabatan}</span>}
                        {r.cabang && r.cabang !== '—' && <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-sky-50 text-sky-600">{r.cabang}</span>}
                      </div>
                    </div>
                  </div>
                  {r.label === 'reward' ? (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600 whitespace-nowrap">Reward</span>
                  ) : r.label === 'sp' ? (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-600 whitespace-nowrap">SP</span>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50 rounded-lg py-1.5"><p className="text-[9px] text-emerald-500 font-bold uppercase">Hadir</p><p className="text-sm font-bold text-emerald-600">{r.hadir}</p></div>
                  <div className="bg-amber-50 rounded-lg py-1.5"><p className="text-[9px] text-amber-500 font-bold uppercase">Terlambat</p><p className="text-sm font-bold text-amber-600">{r.terlambat}</p></div>
                  <div className="bg-rose-50 rounded-lg py-1.5"><p className="text-[9px] text-rose-500 font-bold uppercase">Alpha</p><p className="text-sm font-bold text-rose-600">{r.tidakHadir}</p></div>
                  <div className="bg-orange-50 rounded-lg py-1.5"><p className="text-[9px] text-orange-500 font-bold uppercase">Alfa</p><p className="text-sm font-bold text-orange-600">{r.alfa}</p></div>
                  <div className="bg-slate-50 rounded-lg py-1.5"><p className="text-[9px] text-slate-400 font-bold uppercase">Off</p><p className="text-sm font-bold text-slate-500">{r.off}</p></div>
                  <div className="bg-slate-100 rounded-lg py-1.5"><p className="text-[9px] text-slate-400 font-bold uppercase">Total</p><p className="text-sm font-bold text-slate-700">{r.total}</p></div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-12 text-center text-slate-400">
              {rekap.length === 0 ? `Belum ada data kehadiran pada ${rangeLabel}.` : 'Tidak ada karyawan yang cocok dengan filter.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
