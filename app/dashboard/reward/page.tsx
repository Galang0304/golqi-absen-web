'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-collections';
import { createDocument, updateDocument, deleteDocument } from '@/lib/firestore-helpers';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/dashboard/Modal';
import DateRangeFilter, { DateRange } from '@/components/dashboard/DateRangeFilter';
import type { Reward } from '@/types';

const rupiah = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

const NOMINAL_PRESETS = [50000, 100000, 200000, 500000];

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

export default function RewardPage() {
  const { userData } = useAuth();
  const [items, setItems] = useState<Reward[]>([]);
  const [karyawanList, setKaryawanList] = useState<KaryawanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [range, setRange] = useState<DateRange>(monthRange());

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    userId: '',
    kategori: '',
    nominal: 0,
    alasan: '',
    tanggal: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reward | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubReward = onSnapshot(
      query(
        collection(db, COLLECTIONS.REWARD),
        where('tanggal', '>=', Timestamp.fromDate(range.start)),
        where('tanggal', '<=', Timestamp.fromDate(range.end))
      ),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reward);
        rows.sort((a, b) => (b.tanggal?.toMillis?.() ?? 0) - (a.tanggal?.toMillis?.() ?? 0));
        setItems(rows);
        setLoading(false);
      },
      (err) => {
        console.error('reward listener error:', err);
        setLoading(false);
      }
    );
    return () => unsubReward();
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

    return () => unsubKaryawan();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ userId: '', kategori: '', nominal: 0, alasan: '', tanggal: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };

  const openEdit = (i: Reward) => {
    setEditing(i);
    setForm({
      userId: i.userId,
      kategori: i.kategori || '',
      nominal: i.nominal || 0,
      alasan: i.alasan || '',
      tanggal: (i.tanggal?.toDate?.() ?? new Date()).toISOString().slice(0, 10),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.userId || form.nominal <= 0) return;
    const karyawan = karyawanList.find((k) => k.id === form.userId);
    if (!karyawan) return;
    setSaving(true);
    try {
      const payload = {
        userId: karyawan.id,
        userNama: karyawan.nama,
        cabang: karyawan.cabang,
        kategori: form.kategori.trim(),
        nominal: Number(form.nominal) || 0,
        alasan: form.alasan.trim(),
        tanggal: Timestamp.fromDate(new Date(form.tanggal)),
      };
      if (editing) {
        await updateDocument(COLLECTIONS.REWARD, editing.id, payload);
      } else {
        await createDocument(COLLECTIONS.REWARD, { ...payload, issuedBy: userData?.nama || 'Admin' });
      }
      setModalOpen(false);
    } catch (err) {
      console.error('save reward error:', err);
      alert('Gagal menyimpan reward.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteDocument(COLLECTIONS.REWARD, deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('delete reward error:', err);
      alert('Gagal menghapus reward.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(
    () => items.filter((i) => i.userNama.toLowerCase().includes(searchTerm.toLowerCase())),
    [items, searchTerm]
  );
  const totalReward = useMemo(() => filtered.reduce((sum, i) => sum + (i.nominal || 0), 0), [filtered]);

  const fmtDate = (ts?: Timestamp) =>
    ts?.toDate?.().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reward Karyawan</h1>
          <p className="text-sm text-slate-500 mt-1">Berikan bonus/reward beserta nominal kepada karyawan berprestasi.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DateRangeFilter value={range} onChange={setRange} />
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4.5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm shadow-emerald-500/10 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Beri Reward
          </button>
        </div>
      </div>

      {/* Filter + total */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
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
            className="w-full pl-9 pr-4 py-2.5 text-xs text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition"
            placeholder="Cari nama karyawan..."
          />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs">
          <span className="text-slate-500">Total reward: </span>
          <span className="font-bold text-emerald-600">{rupiah(totalReward)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[760px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Karyawan</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Keterangan</th>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4 text-right">Nominal</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Memuat data reward...
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold rounded-xl flex items-center justify-center">
                          {(i.userNama || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{i.userNama}</p>
                          {i.cabang && <p className="text-[10px] text-slate-400 mt-0.5">{i.cabang}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {i.kategori ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600">{i.kategori}</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{i.alasan || '—'}</td>
                    <td className="px-6 py-4 text-slate-600">{fmtDate(i.tanggal)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">{rupiah(i.nominal || 0)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(i)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          title="Edit Reward"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(i)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Hapus Reward"
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    Belum ada reward.
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
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Memuat data reward...
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((i) => (
              <div key={i.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold rounded-xl flex items-center justify-center flex-shrink-0">
                    {(i.userNama || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{i.userNama}</p>
                        {i.cabang && <p className="text-[11px] text-slate-400 truncate">{i.cabang}</p>}
                      </div>
                      {i.kategori && <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600 whitespace-nowrap">{i.kategori}</span>}
                    </div>
                    {i.alasan && <p className="mt-2 text-[12px] text-slate-600">{i.alasan}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">{fmtDate(i.tanggal)}</span>
                      <span className="text-[12px] font-bold text-emerald-600">{rupiah(i.nominal || 0)}</span>
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
            <div className="px-4 py-12 text-center text-slate-400">Belum ada reward.</div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Reward' : 'Beri Reward'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer">Batal</button>
            <button onClick={handleSave} disabled={saving || !form.userId || form.nominal <= 0} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Menyimpan...' : editing ? 'Simpan' : 'Beri Reward'}
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
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition cursor-pointer"
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
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Kategori <span className="text-slate-400 font-normal">(opsional)</span></label>
            <input
              type="text"
              value={form.kategori}
              onChange={(e) => setForm({ ...form, kategori: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition"
              placeholder="Contoh: Kehadiran Sempurna"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nominal Reward</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm text-slate-400 pointer-events-none">Rp</span>
              <input
                aria-label="Nominal Reward"
                type="number"
                min={0}
                value={form.nominal || ''}
                onChange={(e) => setForm({ ...form, nominal: Number(e.target.value) })}
                className="w-full pl-9 pr-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition"
                placeholder="0"
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {NOMINAL_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm({ ...form, nominal: p })}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition cursor-pointer"
                >
                  {rupiah(p)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tanggal</label>
            <input
              aria-label="Tanggal"
              type="date"
              value={form.tanggal}
              onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Keterangan <span className="text-slate-400 font-normal">(opsional)</span></label>
            <textarea
              value={form.alasan}
              onChange={(e) => setForm({ ...form, alasan: e.target.value })}
              rows={2}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition resize-none"
              placeholder="Contoh: Tidak pernah terlambat bulan ini"
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Reward"
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
          Hapus reward <span className="font-bold text-slate-800">{deleteTarget && rupiah(deleteTarget.nominal)}</span> untuk <span className="font-bold text-slate-800">{deleteTarget?.userNama}</span>?
        </p>
      </Modal>
    </div>
  );
}
