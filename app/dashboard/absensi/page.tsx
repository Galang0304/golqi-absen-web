'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-collections';
import { createDocument, deleteDocument } from '@/lib/firestore-helpers';
import Modal from '@/components/dashboard/Modal';
import DateRangeFilter, { DateRange } from '@/components/dashboard/DateRangeFilter';
import type { Absensi } from '@/types';

interface AbsensiRow {
  id: string;
  userId: string;
  nik: string;
  nama: string;
  role: string;
  tanggal: string;
  clockIn: string;
  status: string;
  lokasi: string;
  hasLokasi: boolean;
  shift: string;
  fotoClockIn?: string;
  lat?: number;
  lng?: number;
}

interface KaryawanOption {
  id: string;
  nama: string;
  shift: string;
}

const statusMap: Record<string, string> = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  tidak_hadir: 'Alpha',
};

function todayRange(): DateRange {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default function AbsensiPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [range, setRange] = useState<DateRange>(todayRange());
  const [absensiData, setAbsensiData] = useState<AbsensiRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [karyawanList, setKaryawanList] = useState<KaryawanOption[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ userId: '', status: 'hadir' });
  const [saving, setSaving] = useState(false);
  const [detailTarget, setDetailTarget] = useState<AbsensiRow | null>(null);

  useEffect(() => {
    setLoading(true);
    const fmt = (ts?: Timestamp) =>
      ts?.toDate?.().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) ?? '—';
    const fmtDate = (ts?: Timestamp) =>
      ts?.toDate?.().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) ?? '—';

    const unsub = onSnapshot(
      query(
        collection(db, COLLECTIONS.ABSENSI),
        where('tanggal', '>=', Timestamp.fromDate(range.start)),
        where('tanggal', '<=', Timestamp.fromDate(range.end))
      ),
      (snap) => {
        const rows: AbsensiRow[] = snap.docs.map((d) => {
          const a = { id: d.id, ...d.data() } as Absensi & { id: string };
          return {
            id: a.id,
            userId: a.userId || '',
            nik: a.userNip || '—',
            nama: a.userNama || 'Karyawan',
            role: '—',
            tanggal: fmtDate(a.tanggal),
            clockIn: fmt(a.clockIn),
            status: statusMap[a.status] || a.status,
            lokasi: a.lokasiClockIn ? 'Dalam Radius' : '—',
            hasLokasi: !!a.lokasiClockIn,
            shift: a.shift || '—',
            fotoClockIn: a.fotoClockIn,
            lat: a.lokasiClockIn?.latitude,
            lng: a.lokasiClockIn?.longitude,
          };
        });
        rows.sort((x, y) => x.nama.localeCompare(y.nama));
        setAbsensiData(rows);
        setLoading(false);
      },
      (err) => {
        console.error('absensi listener error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [range]);

  useEffect(() => {
    const unsubKaryawan = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where('role', '==', 'karyawan')),
      (snap) => {
        const list = snap.docs.map((d) => {
          const u = d.data() as { nama?: string; shift?: string };
          return { id: d.id, nama: u.nama || 'Tanpa Nama', shift: u.shift || '' };
        });
        list.sort((a, b) => a.nama.localeCompare(b.nama));
        setKaryawanList(list);
      },
      (err) => console.error('karyawan listener error:', err)
    );

    return () => unsubKaryawan();
  }, []);

  const handleManualAbsen = async () => {
    if (!manualForm.userId) return;
    const karyawan = karyawanList.find((k) => k.id === manualForm.userId);
    if (!karyawan) return;
    setSaving(true);
    try {
      // Cegah duplikat: cek apakah karyawan sudah punya absensi hari ini
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      // Query hanya by userId (single field, tanpa composite index), filter tanggal di client
      const existing = await getDocs(
        query(collection(db, COLLECTIONS.ABSENSI), where('userId', '==', karyawan.id))
      );
      const sudahAbsenHariIni = existing.docs.some((d) => {
        const t = (d.data().tanggal as Timestamp | undefined)?.toDate?.();
        return t && t >= start && t <= end;
      });
      if (sudahAbsenHariIni) {
        alert(`${karyawan.nama} sudah memiliki absensi hari ini.`);
        setSaving(false);
        return;
      }

      const now = Timestamp.now();
      const payload: Record<string, unknown> = {
        userId: karyawan.id,
        userNama: karyawan.nama,
        tanggal: now,
        shift: karyawan.shift,
        status: manualForm.status,
        keterangan: 'Input manual oleh admin',
        manual: true,
      };
      // Jam masuk hanya dicatat kalau karyawan benar-benar hadir/terlambat
      if (manualForm.status !== 'tidak_hadir') {
        payload.clockIn = now;
      }
      await createDocument(COLLECTIONS.ABSENSI, payload);
      setManualOpen(false);
      setManualForm({ userId: '', status: 'hadir' });
    } catch (err) {
      console.error('manual absen error:', err);
      alert('Gagal menyimpan absensi manual.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAbsensi = async (id: string) => {
    if (!confirm('Hapus data absensi ini?')) return;
    try {
      await deleteDocument(COLLECTIONS.ABSENSI, id);
    } catch (err) {
      console.error('delete absensi error:', err);
      alert('Gagal menghapus absensi.');
    }
  };

  const handleExport = () => {
    const header = ['Nama', 'Shift', 'Jam Masuk', 'Status', 'Lokasi'];
    const rows = filteredData.map((a) => [a.nama, a.shift, a.clockIn, a.status, a.lokasi]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `absensi-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter based on controls
  const filteredData = absensiData.filter((a) => {
    const matchesSearch = a.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          a.nik.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          a.role.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'Semua' || a.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Daftar Kehadiran Karyawan</h1>
          <p className="text-sm text-slate-500 mt-1">Pantau absensi masuk karyawan sesuai rentang tanggal.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={filteredData.length === 0}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Ekspor CSV
          </button>
          <button
            onClick={() => setManualOpen(true)}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition shadow-sm shadow-rose-500/10 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Isi Absensi Manual
          </button>
        </div>
      </div>


      {/* Main Content Area */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Filters and Controls */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          <div className="flex flex-wrap gap-2">
            {/* Status Filter Dropdown */}
            <select 
              aria-label="Filter status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 text-xs text-slate-700 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition cursor-pointer"
            >
              <option value="Semua">Semua Status</option>
              <option value="Hadir">Hadir</option>
              <option value="Terlambat">Terlambat</option>
              <option value="Cuti">Cuti</option>
              <option value="Alpha">Alpha</option>
            </select>

            {/* Date Range Filter (calendar) */}
            <DateRangeFilter value={range} onChange={setRange} />
          </div>

          {/* Search Bar */}
          <div className="relative md:w-80">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition duration-150"
              placeholder="Cari karyawan, NIK, atau divisi..."
            />
          </div>
        </div>

        {/* Table Container */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[880px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Nama Karyawan</th>
                <th className="px-6 py-4">Shift</th>
                <th className="px-6 py-4">Jam Masuk</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Lokasi & GPS</th>
                <th className="px-6 py-4 text-right">Aksi / Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Memuat data absensi...
                  </td>
                </tr>
              ) : filteredData.length > 0 ? (
                filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/30 transition">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-slate-800">{row.nama}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{row.tanggal} • {row.nik}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{row.shift}</td>
                    <td className="px-6 py-4 font-mono font-medium text-slate-600">
                      <span className={row.status === 'Terlambat' ? 'text-amber-600 font-bold' : ''}>
                        {row.clockIn}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        row.status === 'Hadir' 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : row.status === 'Terlambat'
                          ? 'bg-amber-50 text-amber-600'
                          : row.status === 'Cuti'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-rose-50 text-rose-600'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-slate-700">{row.lokasi}</span>
                        {row.hasLokasi ? (
                          <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Valid GPS
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Input manual</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setDetailTarget(row)}
                          className="flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-1 transition cursor-pointer"
                          title="Lihat foto & lokasi absen"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Detail
                        </button>
                        <button
                          onClick={() => handleDeleteAbsensi(row.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Hapus absensi"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Data absensi tidak ditemukan
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
              Memuat data absensi...
            </div>
          ) : filteredData.length > 0 ? (
            filteredData.map((row) => (
              <div key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{row.nama}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{row.tanggal} • {row.nik}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                    row.status === 'Hadir' ? 'bg-emerald-50 text-emerald-600'
                      : row.status === 'Terlambat' ? 'bg-amber-50 text-amber-600'
                      : row.status === 'Cuti' ? 'bg-blue-50 text-blue-600'
                      : 'bg-rose-50 text-rose-600'
                  }`}>{row.status}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-slate-500">Shift: <span className="font-medium text-slate-700">{row.shift}</span></span>
                  <span className="text-slate-500">Jam Masuk: <span className={`font-mono font-medium ${row.status === 'Terlambat' ? 'text-amber-600' : 'text-slate-700'}`}>{row.clockIn}</span></span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Lokasi: <span className="font-medium text-slate-700">{row.lokasi}</span>
                  {row.hasLokasi ? <span className="ml-1 text-emerald-500 font-semibold">• Valid GPS</span> : <span className="ml-1 text-slate-400">• Manual</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setDetailTarget(row)} className="flex-1 flex items-center justify-center text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg py-1.5 transition cursor-pointer">Detail</button>
                  <button onClick={() => handleDeleteAbsensi(row.id)} className="flex-1 flex items-center justify-center text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg py-1.5 transition cursor-pointer">Hapus</button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-12 text-center text-slate-400">Data absensi tidak ditemukan</div>
          )}
        </div>
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-semibold text-slate-500">
          <span>Menampilkan {filteredData.length} data absensi</span>
        </div>

      </div>

      {/* Manual Absensi Modal */}
      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Isi Absensi Manual"
        footer={
          <>
            <button onClick={() => setManualOpen(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer">Batal</button>
            <button onClick={handleManualAbsen} disabled={saving || !manualForm.userId} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Menyimpan...' : 'Simpan Absensi'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Pilih Karyawan</label>
            <select
              aria-label="Pilih Karyawan"
              value={manualForm.userId}
              onChange={(e) => setManualForm({ ...manualForm, userId: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition cursor-pointer"
            >
              <option value="">— Pilih Karyawan —</option>
              {karyawanList.map((k) => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
            {karyawanList.length === 0 && (
              <p className="text-[10px] text-slate-400 mt-1">Belum ada karyawan. Tambahkan dulu di menu Karyawan.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status Kehadiran</label>
            <select
              aria-label="Status Kehadiran"
              value={manualForm.status}
              onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition cursor-pointer"
            >
              <option value="hadir">Hadir</option>
              <option value="terlambat">Terlambat</option>
              <option value="tidak_hadir">Tidak Hadir</option>
            </select>
          </div>
          <p className="text-[11px] text-slate-400">Jam masuk akan dicatat otomatis sesuai waktu saat ini.</p>
        </div>
      </Modal>

      {/* Detail Absensi Modal (foto & lokasi) */}
      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title="Detail Absensi"
        footer={
          <button
            onClick={() => setDetailTarget(null)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            Tutup
          </button>
        }
      >
        {detailTarget && (
          <div className="space-y-4">
            {/* Info ringkas */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-xl flex items-center justify-center">
                {detailTarget.nama.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-slate-800">{detailTarget.nama}</p>
                <p className="text-[11px] text-slate-400">{detailTarget.tanggal} • Masuk {detailTarget.clockIn}</p>
              </div>
            </div>

            {/* Foto selfie */}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1.5">Foto Selfie</p>
              {detailTarget.fotoClockIn ? (
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={detailTarget.fotoClockIn} alt="Foto masuk" className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                  <figcaption className="text-[10px] text-slate-400 text-center mt-1">Foto saat absen masuk</figcaption>
                </figure>
              ) : (
                <div className="h-24 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
                  Belum ada foto (absen manual / app belum kirim)
                </div>
              )}
            </div>

            {/* Lokasi */}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1.5">Lokasi Absen</p>
              {detailTarget.lat != null && detailTarget.lng != null ? (
                <div className="space-y-2">
                  <iframe
                    title="Peta lokasi absen"
                    className="w-full h-40 rounded-xl border border-slate-200"
                    loading="lazy"
                    src={`https://www.google.com/maps?q=${detailTarget.lat},${detailTarget.lng}&z=17&output=embed`}
                  />
                  <a
                    href={`https://www.google.com/maps?q=${detailTarget.lat},${detailTarget.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Buka di Google Maps ({detailTarget.lat.toFixed(5)}, {detailTarget.lng.toFixed(5)})
                  </a>
                </div>
              ) : (
                <div className="h-24 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
                  Lokasi tidak tersedia (absen manual)
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
