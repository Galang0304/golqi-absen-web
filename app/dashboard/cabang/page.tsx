'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-collections';
import { createDocument, updateDocument, deleteDocument } from '@/lib/firestore-helpers';
import Modal from '@/components/dashboard/Modal';
import MapPicker from '@/components/dashboard/MapPicker';
import type { Outlet } from '@/types';

const emptyForm = { nama: '', alamat: '', latitude: undefined as number | undefined, longitude: undefined as number | undefined, radius: 100 };

export default function CabangPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Outlet | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Outlet | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, COLLECTIONS.OUTLETS), orderBy('nama')),
      (snap) => {
        setOutlets(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Outlet));
        setLoading(false);
      },
      (err) => {
        console.error('outlet listener error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (o: Outlet) => {
    setEditing(o);
    setForm({
      nama: o.nama,
      alamat: o.alamat || '',
      latitude: o.latitude,
      longitude: o.longitude,
      radius: o.radius ?? 100,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nama.trim()) return;
    setSaving(true);
    try {
      const payload = {
        nama: form.nama.trim(),
        alamat: form.alamat.trim(),
        latitude: form.latitude ?? null,
        longitude: form.longitude ?? null,
        radius: Number(form.radius) || 100,
      };
      if (editing) {
        await updateDocument(COLLECTIONS.OUTLETS, editing.id, payload);
      } else {
        await createDocument(COLLECTIONS.OUTLETS, payload);
      }
      setModalOpen(false);
    } catch (err) {
      console.error('save outlet error:', err);
      alert('Gagal menyimpan cabang.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteDocument(COLLECTIONS.OUTLETS, deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('delete outlet error:', err);
      alert('Gagal menghapus cabang.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cabang / Outlet</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola daftar cabang untuk penempatan karyawan.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4.5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm shadow-rose-500/10 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Cabang
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : outlets.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-sm font-semibold text-slate-700">Belum Ada Cabang</p>
          <p className="text-xs text-slate-400 mt-1">Klik &quot;Tambah Cabang&quot; untuk membuat outlet pertama.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {outlets.map((o) => (
            <div key={o.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-800">{o.nama}</h3>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(o)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer" title="Edit">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button onClick={() => setDeleteTarget(o)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer" title="Hapus">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              {o.alamat && <p className="mt-3 text-xs text-slate-500">{o.alamat}</p>}
              {o.latitude != null && o.longitude != null ? (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Zona absen {o.radius ?? 100} m
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-amber-600 font-semibold">Titik lokasi belum diatur</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Cabang' : 'Tambah Cabang'}
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
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nama Cabang</label>
            <input
              type="text"
              autoFocus
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              placeholder="Contoh: Outlet Cikupa"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Alamat (opsional)</label>
            <input
              type="text"
              value={form.alamat}
              onChange={(e) => setForm({ ...form, alamat: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              placeholder="Alamat cabang"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Titik Lokasi & Zona Absen</label>
            <MapPicker
              latitude={form.latitude}
              longitude={form.longitude}
              radius={form.radius}
              onLocationChange={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
              onRadiusChange={(r) => setForm((prev) => ({ ...prev, radius: r }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Radius Zona Absen (meter)</label>
            <input
              aria-label="Radius zona absen"
              type="number"
              min={10}
              step={10}
              value={form.radius}
              onChange={(e) => setForm({ ...form, radius: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              placeholder="Contoh: 100"
            />
            <p className="text-[10px] text-slate-400 mt-1">Karyawan hanya bisa absen bila berada dalam radius ini dari titik outlet.</p>
            {form.latitude != null && form.longitude != null && (
              <p className="text-[10px] text-slate-400 mt-0.5">Koordinat: {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Cabang"
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
          Yakin ingin menghapus cabang <span className="font-bold text-slate-800">{deleteTarget?.nama}</span>?
        </p>
      </Modal>
    </div>
  );
}
