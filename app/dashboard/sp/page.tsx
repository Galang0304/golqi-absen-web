'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-collections';
import { createDocument, updateDocument, deleteDocument } from '@/lib/firestore-helpers';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/dashboard/Modal';
import DateRangeFilter, { DateRange } from '@/components/dashboard/DateRangeFilter';
import type { SuratPeringatan, JenisSP } from '@/types';

const SP_LABELS: Record<JenisSP, string> = {
  teguran: 'Surat Teguran',
  sp1: 'Surat Peringatan I',
  sp2: 'Surat Peringatan II',
  sp3: 'Surat Peringatan III',
};

const DEFAULT_NOMINAL: Record<JenisSP, number> = {
  teguran: 50000,
  sp1: 100000,
  sp2: 200000,
  sp3: 300000,
};

const JENIS_ORDER: JenisSP[] = ['teguran', 'sp1', 'sp2', 'sp3'];

const rupiah = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

function monthRange(): DateRange {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

interface KaryawanOption {
  id: string;
  nama: string;
  cabang: string;
}

export default function SPPage() {
  const { userData } = useAuth();
  const [items, setItems] = useState<SuratPeringatan[]>([]);
  const [karyawanList, setKaryawanList] = useState<KaryawanOption[]>([]);
  const [nominal, setNominal] = useState<Record<JenisSP, number>>(DEFAULT_NOMINAL);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('Semua');
  const [range, setRange] = useState<DateRange>(monthRange());

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<{ userId: string; jenis: JenisSP; alasan: string; tanggal: string }>({
    userId: '',
    jenis: 'teguran',
    alasan: '',
    tanggal: new Date().toISOString().slice(0, 10),
  });
  const [editing, setEditing] = useState<SuratPeringatan | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SuratPeringatan | null>(null);

  // Config (Atur Nominal) modal
  const [configOpen, setConfigOpen] = useState(false);
  const [configForm, setConfigForm] = useState<Record<JenisSP, number>>(DEFAULT_NOMINAL);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubSp = onSnapshot(
      query(
        collection(db, COLLECTIONS.SP),
        where('tanggal', '>=', Timestamp.fromDate(range.start)),
        where('tanggal', '<=', Timestamp.fromDate(range.end))
      ),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SuratPeringatan);
        rows.sort((a, b) => (b.tanggal?.toMillis?.() ?? 0) - (a.tanggal?.toMillis?.() ?? 0));
        setItems(rows);
        setLoading(false);
      },
      (err) => {
        console.error('sp listener error:', err);
        setLoading(false);
      }
    );
    return () => unsubSp();
  }, [range]);

  useEffect(() => {
    const unsubKaryawan = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where('role', '==', 'karyawan')),
      (snap) => {
        const list = snap.docs.map((d) => {
          const u = d.data() as { nama?: string; cabang?: string };
          return { id: d.id, nama: u.nama || 'Tanpa Nama', cabang: u.cabang || '' };
        });
        list.sort((a, b) => a.nama.localeCompare(b.nama));
        setKaryawanList(list);
      },
      (err) => console.error('karyawan listener error:', err)
    );

    // SP nominal config (settings/sp)
    const unsubConfig = onSnapshot(
      doc(db, COLLECTIONS.SETTINGS, 'sp'),
      (snap) => {
        const data = snap.data() as Partial<Record<JenisSP, number>> | undefined;
        setNominal({
          teguran: data?.teguran ?? DEFAULT_NOMINAL.teguran,
          sp1: data?.sp1 ?? DEFAULT_NOMINAL.sp1,
          sp2: data?.sp2 ?? DEFAULT_NOMINAL.sp2,
          sp3: data?.sp3 ?? DEFAULT_NOMINAL.sp3,
        });
      },
      (err) => console.error('sp config listener error:', err)
    );

    return () => {
      unsubKaryawan();
      unsubConfig();
    };
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ userId: '', jenis: 'teguran', alasan: '', tanggal: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };

  const openEdit = (i: SuratPeringatan) => {
    setEditing(i);
    setForm({
      userId: i.userId,
      jenis: i.jenis,
      alasan: i.alasan,
      tanggal: (i.tanggal?.toDate?.() ?? new Date()).toISOString().slice(0, 10),
    });
    setModalOpen(true);
  };

  const openConfig = () => {
    setConfigForm({ ...nominal });
    setConfigOpen(true);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await setDoc(
        doc(db, COLLECTIONS.SETTINGS, 'sp'),
        {
          teguran: Number(configForm.teguran) || 0,
          sp1: Number(configForm.sp1) || 0,
          sp2: Number(configForm.sp2) || 0,
          sp3: Number(configForm.sp3) || 0,
          updatedAt: Timestamp.now(),
          updatedBy: userData?.nama || 'Admin',
        },
        { merge: true }
      );
      setConfigOpen(false);
    } catch (err) {
      console.error('save sp config error:', err);
      alert('Gagal menyimpan pengaturan nominal.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSave = async () => {
    if (!form.userId || !form.alasan.trim()) return;
    const karyawan = karyawanList.find((k) => k.id === form.userId);
    if (!karyawan) return;
    setSaving(true);
    try {
      // Pertahankan nominal asli jika jenis tidak berubah; jika berubah pakai config terbaru
      const nom = editing && editing.jenis === form.jenis ? editing.nominal : nominal[form.jenis];
      const payload = {
        userId: karyawan.id,
        userNama: karyawan.nama,
        cabang: karyawan.cabang,
        jenis: form.jenis,
        nominal: nom,
        alasan: form.alasan.trim(),
        tanggal: Timestamp.fromDate(new Date(form.tanggal)),
      };
      if (editing) {
        await updateDocument(COLLECTIONS.SP, editing.id, payload);
      } else {
        await createDocument(COLLECTIONS.SP, { ...payload, issuedBy: userData?.nama || 'Admin' });
      }
      setModalOpen(false);
    } catch (err) {
      console.error('save sp error:', err);
      alert('Gagal menyimpan Surat Peringatan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteDocument(COLLECTIONS.SP, deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('delete sp error:', err);
      alert('Gagal menghapus SP.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = filter === 'Semua' ? items : items.filter((i) => i.jenis === filter);
  const totalPotongan = useMemo(() => filtered.reduce((sum, i) => sum + (i.nominal || 0), 0), [filtered]);

  const fmtDate = (ts?: Timestamp) =>
    ts?.toDate?.().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—';

  const badgeColor = (jenis: JenisSP) =>
    jenis === 'teguran'
      ? 'bg-slate-100 text-slate-600'
      : jenis === 'sp1'
      ? 'bg-amber-50 text-amber-600'
      : jenis === 'sp2'
      ? 'bg-orange-50 text-orange-600'
      : 'bg-rose-50 text-rose-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Surat Peringatan (SP)</h1>
          <p className="text-sm text-slate-500 mt-1">Terbitkan teguran/peringatan beserta potongan gaji pokok karyawan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DateRangeFilter value={range} onChange={setRange} />
          <button
            onClick={openConfig}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Atur Nominal
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4.5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm shadow-rose-500/10 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Terbitkan SP
          </button>
        </div>
      </div>

      {/* Rule reference cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {JENIS_ORDER.map((j) => (
          <div key={j} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">{SP_LABELS[j]}</p>
            <p className="text-lg font-extrabold text-slate-800 mt-1">{rupiah(nominal[j])}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">potongan gaji pokok</p>
          </div>
        ))}
      </div>

      {/* Filter + total */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
          {['Semua', ...JENIS_ORDER].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filter === tab ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab === 'Semua' ? 'Semua' : SP_LABELS[tab as JenisSP]}
            </button>
          ))}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs">
          <span className="text-slate-500">Total potongan: </span>
          <span className="font-bold text-rose-600">{rupiah(totalPotongan)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[760px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Karyawan</th>
                <th className="px-6 py-4">Jenis</th>
                <th className="px-6 py-4">Alasan</th>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4 text-right">Potongan</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Memuat data SP...
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-xl flex items-center justify-center">
                          {(i.userNama || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{i.userNama}</p>
                          {i.cabang && <p className="text-[10px] text-slate-400 mt-0.5">{i.cabang}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${badgeColor(i.jenis)}`}>
                        {SP_LABELS[i.jenis] ?? i.jenis}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{i.alasan}</td>
                    <td className="px-6 py-4 text-slate-600">{fmtDate(i.tanggal)}</td>
                    <td className="px-6 py-4 text-right font-bold text-rose-600">{rupiah(i.nominal || 0)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(i)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          title="Edit SP"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(i)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Hapus SP"
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Belum ada Surat Peringatan.
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
              Memuat data SP...
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((i) => (
              <div key={i.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-xl flex items-center justify-center flex-shrink-0">
                    {(i.userNama || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{i.userNama}</p>
                        {i.cabang && <p className="text-[11px] text-slate-400 truncate">{i.cabang}</p>}
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap ${badgeColor(i.jenis)}`}>{SP_LABELS[i.jenis] ?? i.jenis}</span>
                    </div>
                    <p className="mt-2 text-[12px] text-slate-600">{i.alasan}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">{fmtDate(i.tanggal)}</span>
                      <span className="text-[12px] font-bold text-rose-600">{rupiah(i.nominal || 0)}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => openEdit(i)} className="flex-1 flex items-center justify-center text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg py-1.5 transition cursor-pointer">Edit</button>
                      <button onClick={() => setDeleteTarget(i)} className="flex-1 flex items-center justify-center text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg py-1.5 transition cursor-pointer">Hapus</button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-12 text-center text-slate-400">Belum ada Surat Peringatan.</div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Surat Peringatan' : 'Terbitkan Surat Peringatan'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer">Batal</button>
            <button onClick={handleSave} disabled={saving || !form.userId || !form.alasan.trim()} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Menyimpan...' : editing ? 'Simpan' : 'Terbitkan'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Karyawan</label>
            <select
              aria-label="Pilih Karyawan"
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition cursor-pointer"
            >
              <option value="">— Pilih Karyawan —</option>
              {karyawanList.map((k) => (
                <option key={k.id} value={k.id}>{k.nama}{k.cabang ? ` — ${k.cabang}` : ''}</option>
              ))}
            </select>
            {karyawanList.length === 0 && (
              <p className="text-[10px] text-slate-400 mt-1">Belum ada karyawan. Tambahkan dulu di menu Karyawan.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jenis SP</label>
            <select
              aria-label="Jenis SP"
              value={form.jenis}
              onChange={(e) => setForm({ ...form, jenis: e.target.value as JenisSP })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition cursor-pointer"
            >
              {JENIS_ORDER.map((j) => (
                <option key={j} value={j}>{SP_LABELS[j]} — {rupiah(nominal[j])}</option>
              ))}
            </select>
            <p className="text-[11px] text-rose-600 font-semibold mt-1.5">Potongan gaji pokok: {rupiah(nominal[form.jenis])}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tanggal</label>
            <input
              aria-label="Tanggal"
              type="date"
              value={form.tanggal}
              onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Alasan / Pelanggaran</label>
            <textarea
              value={form.alasan}
              onChange={(e) => setForm({ ...form, alasan: e.target.value })}
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition resize-none"
              placeholder="Contoh: Terlambat berulang tanpa keterangan"
            />
          </div>
        </div>
      </Modal>

      {/* Config (Atur Nominal) Modal */}
      <Modal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Atur Nominal SP"
        footer={
          <>
            <button onClick={() => setConfigOpen(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer">Batal</button>
            <button onClick={handleSaveConfig} disabled={savingConfig} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50">
              {savingConfig ? 'Menyimpan...' : 'Simpan'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-[11px] text-slate-500">Ubah nominal potongan untuk tiap jenis SP. Perubahan hanya berlaku untuk SP yang diterbitkan setelah ini; SP lama tidak berubah.</p>
          {JENIS_ORDER.map((j) => (
            <div key={j}>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">{SP_LABELS[j]}</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm text-slate-400 pointer-events-none">Rp</span>
                <input
                  aria-label={SP_LABELS[j]}
                  type="number"
                  min={0}
                  value={configForm[j]}
                  onChange={(e) => setConfigForm({ ...configForm, [j]: Number(e.target.value) })}
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
                />
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Surat Peringatan"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer">Batal</button>
            <button onClick={handleDelete} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50">
              {saving ? 'Menghapus...' : 'Ya, Hapus'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Hapus SP <span className="font-bold text-slate-800">{deleteTarget && SP_LABELS[deleteTarget.jenis]}</span> untuk <span className="font-bold text-slate-800">{deleteTarget?.userNama}</span>?
        </p>
      </Modal>
    </div>
  );
}
