'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, createKaryawanAuthAccount, auth } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-collections';
import { setDocument, updateDocument, deleteDocument } from '@/lib/firestore-helpers';
import Modal from '@/components/dashboard/Modal';
import type { Shift, Outlet } from '@/types';

interface LeaderRow {
  id: string;
  nama: string;
  email: string;
  noHp: string;
  cabang: string;
  status: string;
  shift: string;
  gajiPokok: number;
  jadwalKerja: string[];
  bergabung: string;
  profileComplete: boolean;
  faceTemplates: number[][];
  fotoWajah?: string;
  faceRegisteredAt?: string;
}

const STATUS_OPTIONS = ['Aktif', 'Cuti', 'Non-aktif'];
const HARI_OPTIONS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

/** Konversi faceTemplates (bisa array lama atau map baru) ke array untuk komponen. */
function normalizeFaceTemplates(raw: any): number[][] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as number[][];
  if (typeof raw === 'object') return Object.values(raw);
  return [];
}

/** Konversi array ke map (Firestore tidak mendukung nested array). */
function toFaceTemplatesMap(templates: number[][] | null): Record<string, number[]> | undefined {
  if (!templates || templates.length === 0) return undefined;
  const map: Record<string, number[]> = {};
  templates.forEach((t, i) => { map[String(i)] = t; });
  return map;
}

const emptyForm = {
  nama: '',
  email: '',
  password: '',
  noHp: '',
  cabang: '',
  shift: '',
  status: 'Aktif',
  gajiPokok: 0,
  jadwalKerja: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as string[],
  faceTemplates: null as number[][] | null,
  fotoWajah: '',
};

export default function LeaderPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<LeaderRow[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaderRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeaderRow | null>(null);

  const [resetTarget, setResetTarget] = useState<LeaderRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [faceDetail, setFaceDetail] = useState<LeaderRow | null>(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where('role', '==', 'leader')),
      (snap) => {
        const rows: LeaderRow[] = snap.docs.map((d) => {
          const u = d.data() as {
            nama?: string; email?: string; noHp?: string; cabang?: string;
            status?: string; shift?: string; gajiPokok?: number; jadwalKerja?: string[];
            createdAt?: { toDate?: () => Date }; profileComplete?: boolean;
            faceTemplates?: number[][] | Record<string, number[]>;
            fotoWajah?: string;
            faceRegisteredAt?: { toDate?: () => Date };
          };
          return {
            id: d.id,
            nama: u.nama || 'Tanpa Nama',
            email: u.email || '—',
            noHp: u.noHp || '',
            cabang: u.cabang || '—',
            status: u.status || 'Aktif',
            shift: u.shift || '—',
            gajiPokok: u.gajiPokok || 0,
            jadwalKerja: Array.isArray(u.jadwalKerja) ? u.jadwalKerja : [],
            bergabung: u.createdAt?.toDate?.().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) || '—',
            profileComplete: u.profileComplete ?? false,
            faceTemplates: normalizeFaceTemplates(u.faceTemplates),
            fotoWajah: u.fotoWajah || '',
            faceRegisteredAt: u.faceRegisteredAt?.toDate?.().toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          };
        });
        rows.sort((a, b) => a.nama.localeCompare(b.nama));
        setData(rows);
        setLoading(false);
      },
      (err) => {
        console.error('leader listener error:', err);
        setLoading(false);
      }
    );

    const unsubShifts = onSnapshot(
      query(collection(db, COLLECTIONS.SHIFTS), orderBy('nama')),
      (snap) => setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Shift)),
      (err) => console.error('shift listener error:', err)
    );
    const unsubOutlets = onSnapshot(
      query(collection(db, COLLECTIONS.OUTLETS), orderBy('nama')),
      (snap) => setOutlets(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Outlet)),
      (err) => console.error('outlet listener error:', err)
    );

    return () => {
      unsubUsers();
      unsubShifts();
      unsubOutlets();
    };
  }, []);

  const setField = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (k: LeaderRow) => {
    setEditing(k);
    setForm({
      nama: k.nama,
      email: k.email === '—' ? '' : k.email,
      password: '',
      noHp: k.noHp,
      cabang: k.cabang === '—' ? '' : k.cabang,
      shift: k.shift === '—' ? '' : k.shift,
      status: k.status,
      gajiPokok: k.gajiPokok,
      jadwalKerja: k.jadwalKerja.length > 0 ? k.jadwalKerja : [...emptyForm.jadwalKerja],
      faceTemplates: k.faceTemplates?.length > 0 ? k.faceTemplates : null,
      fotoWajah: k.fotoWajah || '',
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.nama.trim()) e.nama = 'Nama wajib diisi';
    if (!editing) {
      if (!form.email.trim()) e.email = 'Email wajib diisi';
      if (form.password.length < 6) e.password = 'Password minimal 6 karakter';
    }
    if (!form.gajiPokok || form.gajiPokok <= 0) e.gajiPokok = 'Gaji pokok wajib diisi';
    if (!form.cabang) e.cabang = 'Cabang wajib dipilih';
    if (!form.shift) e.shift = 'Shift kerja wajib dipilih';
    if (form.jadwalKerja.length === 0) e.jadwalKerja = 'Pilih minimal satu hari kerja';
    return e;
  };

  const handleSave = async () => {
    const eObj = validate();
    setErrors(eObj);
    if (Object.keys(eObj).length > 0) return;

    if (editing) {
      setSaving(true);
      try {
        await updateDocument(COLLECTIONS.USERS, editing.id, {
          nama: form.nama.trim(),
          noHp: form.noHp.trim(),
          cabang: form.cabang,
          shift: form.shift,
          status: form.status,
          gajiPokok: Number(form.gajiPokok) || 0,
          jadwalKerja: form.jadwalKerja,
          profileComplete: !!form.noHp.trim(),
          ...(toFaceTemplatesMap(form.faceTemplates) ? {
            faceTemplates: toFaceTemplatesMap(form.faceTemplates),
            fotoWajah: form.fotoWajah || '',
            faceRegisteredAt: new Date(),
            faceRegAllowed: false,
          } : {}),
        });
        setModalOpen(false);
      } catch (err) {
        console.error('update leader error:', err);
        alert('Gagal memperbarui data leader.');
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      const uid = await createKaryawanAuthAccount(form.email.trim(), form.password);
      await setDocument(COLLECTIONS.USERS, uid, {
        uid,
        role: 'leader',
        nama: form.nama.trim(),
        email: form.email.trim(),
        noHp: form.noHp.trim(),
        cabang: form.cabang,
        shift: form.shift,
        status: form.status,
        gajiPokok: Number(form.gajiPokok) || 0,
        jadwalKerja: form.jadwalKerja,
        profileComplete: !!form.noHp.trim(),
        ...(toFaceTemplatesMap(form.faceTemplates) ? {
          faceTemplates: toFaceTemplatesMap(form.faceTemplates),
          fotoWajah: form.fotoWajah || '',
          faceRegisteredAt: new Date(),
          faceRegAllowed: false,
        } : {}),
      });
      setModalOpen(false);
    } catch (err: unknown) {
      console.error('create leader error:', err);
      const code = (err as { code?: string })?.code;
      if (code === 'auth/email-already-in-use') {
        setErrors((p) => ({ ...p, email: 'Email sudah terpakai. Gunakan email lain.' }));
      } else if (code === 'auth/invalid-email') {
        setErrors((p) => ({ ...p, email: 'Format email tidak valid.' }));
      } else {
        alert('Gagal membuat akun leader.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteDocument(COLLECTIONS.USERS, deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('delete leader error:', err);
      alert('Gagal menghapus leader.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || newPassword.length < 6) return;
    setResetting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        alert('Sesi admin tidak valid. Login ulang.');
        setResetting(false);
        return;
      }
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid: resetTarget.id, newPassword }),
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.error || 'Gagal mengganti password.');
        return;
      }
      alert(`Password ${resetTarget.nama} berhasil diganti.`);
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      console.error('reset password error:', err);
      alert('Gagal menghubungi server.');
    } finally {
      setResetting(false);
    }
  };

  const handleResetFace = async (k: LeaderRow) => {
    if (!confirm(`Reset wajah ${k.nama}? Template & foto wajah lama akan dihapus. Karyawan harus daftar wajah baru lagi.`)) return;
    setSaving(true);
    try {
      await updateDocument(COLLECTIONS.USERS, k.id, {
        faceTemplates: null,
        fotoWajah: '',
        faceRegisteredAt: null,
        faceRegAllowed: true,
      });
      alert(`✓ Wajah ${k.nama} di-reset. Karyawan wajib daftar ulang di app.`);
    } catch (err) {
      console.error('reset face error:', err);
      alert('Gagal reset wajah.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = data.filter(
    (k) =>
      k.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.cabang.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputCls = (err?: string) =>
    `w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border ${err ? 'border-rose-400' : 'border-slate-250'} rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Leader</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola akun leader. Leader bisa absen di app & mengatur jadwal tim.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4.5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm shadow-rose-500/10 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Leader
        </button>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
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
              className="w-full pl-9 pr-4 py-2.5 text-xs text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              placeholder="Cari nama, email, atau cabang..."
            />
          </div>
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[820px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                <th className="px-6 py-4">Leader</th>
                <th className="px-6 py-4">Cabang</th>
                <th className="px-6 py-4">Shift</th>
                <th className="px-6 py-4">Gaji/Bln</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Memuat data leader...
                </td></tr>
              ) : filtered.length > 0 ? (
                filtered.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                          {k.fotoWajah ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={k.fotoWajah} alt="Foto wajah" className="w-full h-full object-cover" title="Foto wajah terdaftar" />
                          ) : (
                            k.nama.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{k.nama}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{k.email}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Bergabung {k.bergabung}</p>
                          {k.faceTemplates && k.faceTemplates.length > 0 ? (
                            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                              {k.fotoWajah && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={k.fotoWajah} alt="Wajah" className="w-4 h-4 rounded object-cover border border-emerald-200" />
                              )}
                              ✓ Wajah terdaftar
                            </span>
                          ) : (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-500 text-[10px] font-bold">Wajah belum didaftarkan</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">{k.cabang}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">{k.shift}</td>
                    <td className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">{k.gajiPokok > 0 ? 'Rp ' + k.gajiPokok.toLocaleString('id-ID') : '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        k.status === 'Aktif' ? 'bg-emerald-50 text-emerald-600' : k.status === 'Cuti' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                      }`}>{k.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {k.faceTemplates && k.faceTemplates.length > 0 && (
                          <button onClick={() => setFaceDetail(k)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer" title="Lihat Detail Wajah">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                        )}
                        <button onClick={() => { setResetTarget(k); setNewPassword(''); }} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer" title="Set password baru">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                        </button>
                        {k.faceTemplates && k.faceTemplates.length > 0 && (
                          <button onClick={() => handleResetFace(k)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer" title="Reset Wajah (izinkan registrasi ulang)">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          </button>
                        )}
                        <button onClick={() => openEdit(k)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => setDeleteTarget(k)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer" title="Hapus">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Belum ada leader. Klik &quot;Tambah Leader&quot;.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Card list (mobile) */}
        <div className="lg:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="px-4 py-12 text-center text-slate-400">
              <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Memuat data leader...
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((k) => (
              <div key={k.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-xl flex items-center justify-center flex-shrink-0">
                    {k.nama.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{k.nama}</p>
                        <p className="text-[11px] text-slate-400 truncate">{k.email}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                        k.status === 'Aktif' ? 'bg-emerald-50 text-emerald-600' : k.status === 'Cuti' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                      }`}>{k.status}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-600">{k.cabang}</span>
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-600">{k.shift}</span>
                      {k.faceTemplates && k.faceTemplates.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600">✓ Wajah</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-500">Wajah?</span>
                      )}
                    </div>

                    <div className="mt-2 text-[11px]">
                      <span className="text-slate-400">Gaji/Bln: </span>
                      <span className="font-semibold text-slate-700">{k.gajiPokok > 0 ? 'Rp ' + k.gajiPokok.toLocaleString('id-ID') : '—'}</span>
                    </div>

                    <p className="mt-2 text-[10px] text-slate-400">Bergabung {k.bergabung}</p>

                    <div className="mt-3 flex gap-2">
                      <button onClick={() => { setResetTarget(k); setNewPassword(''); }} className="flex-1 flex items-center justify-center text-[11px] font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg py-1.5 transition cursor-pointer">Password</button>
                      {k.faceTemplates && k.faceTemplates.length > 0 && (
                        <button onClick={() => handleResetFace(k)} className="flex-1 flex items-center justify-center text-[11px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg py-1.5 transition cursor-pointer">Reset Wajah</button>
                      )}
                      <button onClick={() => openEdit(k)} className="flex-1 flex items-center justify-center text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg py-1.5 transition cursor-pointer">Edit</button>
                      <button onClick={() => setDeleteTarget(k)} className="flex-1 flex items-center justify-center text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg py-1.5 transition cursor-pointer">Hapus</button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-12 text-center text-slate-400">Belum ada leader. Klik &quot;Tambah Leader&quot;.</div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Leader' : 'Tambah Leader'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer">Batal</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nama Leader <span className="text-rose-500">*</span></label>
            <input type="text" autoFocus value={form.nama} onChange={(e) => setField('nama', e.target.value)} className={inputCls(errors.nama)} placeholder="Contoh: Andi" />
            {errors.nama && <p className="text-[10px] text-rose-500 mt-1">{errors.nama}</p>}
          </div>
          {!editing && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email (untuk login) <span className="text-rose-500">*</span></label>
                <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} className={inputCls(errors.email)} placeholder="leader@golqi.com" />
                {errors.email && <p className="text-[10px] text-rose-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password Awal <span className="text-rose-500">*</span></label>
                <input type="text" value={form.password} onChange={(e) => setField('password', e.target.value)} className={inputCls(errors.password)} placeholder="Minimal 6 karakter" />
                {errors.password && <p className="text-[10px] text-rose-500 mt-1">{errors.password}</p>}
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nomor HP <span className="text-slate-400 font-normal">(opsional)</span></label>
            <input type="tel" value={form.noHp} onChange={(e) => setField('noHp', e.target.value)} className={inputCls()} placeholder="08xxxxxxxxxx" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gaji Pokok / bulan <span className="text-rose-500">*</span></label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm text-slate-400 pointer-events-none">Rp</span>
              <input aria-label="Gaji Pokok" type="number" min={0} value={form.gajiPokok || ''} onChange={(e) => setField('gajiPokok', Number(e.target.value))}
                className={`w-full pl-9 pr-3.5 py-2.5 text-sm text-slate-900 bg-white border ${errors.gajiPokok ? 'border-rose-400' : 'border-slate-250'} rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition`} placeholder="Contoh: 3500000" />
            </div>
            {errors.gajiPokok && <p className="text-[10px] text-rose-500 mt-1">{errors.gajiPokok}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Penempatan Cabang <span className="text-rose-500">*</span></label>
            <select aria-label="Cabang" value={form.cabang} onChange={(e) => setField('cabang', e.target.value)} className={`${inputCls(errors.cabang)} cursor-pointer`}>
              <option value="">— Pilih Cabang —</option>
              {outlets.map((o) => <option key={o.id} value={o.nama}>{o.nama}</option>)}
            </select>
            {errors.cabang && <p className="text-[10px] text-rose-500 mt-1">{errors.cabang}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Shift Kerja <span className="text-rose-500">*</span></label>
            <select aria-label="Shift" value={form.shift} onChange={(e) => setField('shift', e.target.value)} className={`${inputCls(errors.shift)} cursor-pointer`}>
              <option value="">— Pilih Shift —</option>
              {shifts.map((s) => <option key={s.id} value={s.nama}>{s.nama} ({s.jamMasuk} - {s.jamKeluar})</option>)}
            </select>
            {errors.shift && <p className="text-[10px] text-rose-500 mt-1">{errors.shift}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jadwal Kerja <span className="text-rose-500">*</span></label>
            <div className="flex flex-wrap gap-2">
              {HARI_OPTIONS.map((h) => {
                const checked = form.jadwalKerja.includes(h);
                return (
                  <button key={h} type="button"
                    onClick={() => setField('jadwalKerja', checked ? form.jadwalKerja.filter((d) => d !== h) : [...form.jadwalKerja, h])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${checked ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                    {h.slice(0, 3)}
                  </button>
                );
              })}
            </div>
            {errors.jadwalKerja && <p className="text-[10px] text-rose-500 mt-1">{errors.jadwalKerja}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
            <select aria-label="Status" value={form.status} onChange={(e) => setField('status', e.target.value)} className={`${inputCls()} cursor-pointer`}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Leader"
        footer={<>
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer">Batal</button>
          <button onClick={handleDelete} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50">{saving ? 'Menghapus...' : 'Ya, Hapus'}</button>
        </>}>
        <p className="text-sm text-slate-600">Yakin ingin menghapus <span className="font-bold text-slate-800">{deleteTarget?.nama}</span>?</p>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title="Set Password Baru"
        footer={<>
          <button onClick={() => setResetTarget(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer">Batal</button>
          <button onClick={handleResetPassword} disabled={resetting || newPassword.length < 6} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 transition cursor-pointer disabled:opacity-50">{resetting ? 'Menyimpan...' : 'Set Password'}</button>
        </>}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Atur password baru untuk <span className="font-bold text-slate-800">{resetTarget?.nama}</span>.</p>
          <input type="text" autoFocus value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 transition" placeholder="Minimal 6 karakter" />
        </div>
      </Modal>

      <Modal open={!!faceDetail} onClose={() => setFaceDetail(null)} title="Detail Wajah">
        <div className="space-y-4">
          {faceDetail?.fotoWajah ? (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={faceDetail.fotoWajah} alt="Foto wajah" className="w-48 h-48 object-cover rounded-xl border border-slate-200" />
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-48 h-48 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-sm">Tidak ada foto</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-400 text-xs">Nama</p>
              <p className="font-semibold text-slate-800">{faceDetail?.nama}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Status</p>
              <p className="font-semibold text-emerald-600">✓ Wajah terdaftar</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Terdaftar</p>
              <p className="font-semibold text-slate-800">{faceDetail?.faceRegisteredAt || '-'}</p>
            </div>
          </div>
          <button onClick={() => setFaceDetail(null)} className="w-full px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer">Tutup</button>
        </div>
      </Modal>
    </div>
  );
}
