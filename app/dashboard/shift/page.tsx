'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-collections';
import { createDocument, updateDocument, deleteDocument } from '@/lib/firestore-helpers';
import Modal from '@/components/dashboard/Modal';
import type { Shift } from '@/types';

export default function ShiftPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [form, setForm] = useState({ nama: '', jamMasuk: '07:00', jamKeluar: '15:00', toleransiTerlambat: 15 });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, COLLECTIONS.SHIFTS), orderBy('nama')),
      (snap) => {
        setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Shift));
        setLoading(false);
      },
      (err) => {
        console.error('shift listener error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ nama: '', jamMasuk: '07:00', jamKeluar: '15:00', toleransiTerlambat: 15 });
    setModalOpen(true);
  };

  const openEdit = (s: Shift) => {
    setEditing(s);
    setForm({
      nama: s.nama,
      jamMasuk: s.jamMasuk,
      jamKeluar: s.jamKeluar,
      toleransiTerlambat: s.toleransiTerlambat ?? 15,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nama.trim()) return;
    setSaving(true);
    try {
      const payload = {
        nama: form.nama.trim(),
        jamMasuk: form.jamMasuk,
        jamKeluar: form.jamKeluar,
        toleransiTerlambat: Number(form.toleransiTerlambat) || 0,
      };
      if (editing) {
        await updateDocument(COLLECTIONS.SHIFTS, editing.id, payload);
      } else {
        await createDocument(COLLECTIONS.SHIFTS, payload);
      }
      setModalOpen(false);
    } catch (err) {
      console.error('save shift error:', err);
      alert('Gagal menyimpan shift.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteDocument(COLLECTIONS.SHIFTS, deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('delete shift error:', err);
      alert('Gagal menghapus shift.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Shift Kerja</h1>
          <p className="text-sm text-slate-500 mt-1">Atur jadwal shift, jam masuk, jam keluar, dan toleransi keterlambatan.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4.5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm shadow-rose-500/10 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Shift
        </button>
      </div>

      {/* Grid of shift cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : shifts.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-semibold text-slate-700">Belum Ada Shift</p>
          <p className="text-xs text-slate-400 mt-1">Klik &quot;Tambah Shift&quot; untuk membuat jadwal kerja pertama.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {shifts.map((s) => (
            <div key={s.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-800">{s.nama}</h3>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer" title="Edit">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer" title="Hapus">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Masuk</p>
                  <p className="font-mono font-bold text-slate-700">{s.jamMasuk}</p>
                </div>
                <span className="text-slate-300">→</span>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Keluar</p>
                  <p className="font-mono font-bold text-slate-700">{s.jamKeluar}</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-400">Toleransi terlambat: <span className="font-semibold text-slate-600">{s.toleransiTerlambat ?? 0} menit</span></p>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Shift' : 'Tambah Shift'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer">Batal</button>
            <button onClick={handleSave} disabled={saving || !form.nama.trim()} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nama Shift</label>
            <input
              type="text"
              autoFocus
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              placeholder="Contoh: Shift Pagi"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jam Masuk</label>
              <input
                aria-label="Jam Masuk"
                type="time"
                value={form.jamMasuk}
                onChange={(e) => setForm({ ...form, jamMasuk: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jam Keluar</label>
              <input
                aria-label="Jam Keluar"
                type="time"
                value={form.jamKeluar}
                onChange={(e) => setForm({ ...form, jamKeluar: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Toleransi Terlambat (menit)</label>
            <input
              aria-label="Toleransi Terlambat (menit)"
              type="number"
              min={0}
              value={form.toleransiTerlambat}
              onChange={(e) => setForm({ ...form, toleransiTerlambat: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Shift"
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
          Yakin ingin menghapus shift <span className="font-bold text-slate-800">{deleteTarget?.nama}</span>?
        </p>
      </Modal>
    </div>
  );
}
