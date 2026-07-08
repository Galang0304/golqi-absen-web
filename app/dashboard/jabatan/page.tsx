'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-collections';
import { createDocument, updateDocument, deleteDocument } from '@/lib/firestore-helpers';
import Modal from '@/components/dashboard/Modal';
import type { Jabatan } from '@/types';

export default function JabatanPage() {
  const [items, setItems] = useState<Jabatan[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Jabatan | null>(null);
  const [form, setForm] = useState({ nama: '', keterangan: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Jabatan | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, COLLECTIONS.JABATAN), orderBy('nama')),
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Jabatan));
        setLoading(false);
      },
      (err) => {
        console.error('jabatan listener error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ nama: '', keterangan: '' });
    setModalOpen(true);
  };

  const openEdit = (j: Jabatan) => {
    setEditing(j);
    setForm({ nama: j.nama, keterangan: j.keterangan || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nama.trim()) return;
    setSaving(true);
    try {
      const payload = { nama: form.nama.trim(), keterangan: form.keterangan.trim() };
      if (editing) {
        await updateDocument(COLLECTIONS.JABATAN, editing.id, payload);
      } else {
        await createDocument(COLLECTIONS.JABATAN, payload);
      }
      setModalOpen(false);
    } catch (err) {
      console.error('save jabatan error:', err);
      alert('Gagal menyimpan jabatan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteDocument(COLLECTIONS.JABATAN, deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('delete jabatan error:', err);
      alert('Gagal menghapus jabatan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Jabatan / Role</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola jabatan karyawan (mis. Kitchen, Kasir) untuk dipilih saat menambah karyawan.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4.5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm shadow-rose-500/10 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Jabatan
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p className="text-sm font-semibold text-slate-700">Belum Ada Jabatan</p>
          <p className="text-xs text-slate-400 mt-1">Tambahkan jabatan dulu (mis. Kitchen, Kasir) supaya bisa buat karyawan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((j) => (
            <div key={j.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-800">{j.nama}</h3>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(j)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer" title="Edit">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button onClick={() => setDeleteTarget(j)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer" title="Hapus">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              {j.keterangan && <p className="mt-3 text-[11px] text-slate-400">{j.keterangan}</p>}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Jabatan' : 'Tambah Jabatan'}
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
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nama Jabatan</label>
            <input
              type="text"
              autoFocus
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              placeholder="Contoh: Kitchen"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Keterangan <span className="text-slate-400 font-normal">(opsional)</span></label>
            <input
              type="text"
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              placeholder="Deskripsi singkat"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Jabatan"
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
          Yakin ingin menghapus jabatan <span className="font-bold text-slate-800">{deleteTarget?.nama}</span>?
        </p>
      </Modal>
    </div>
  );
}
