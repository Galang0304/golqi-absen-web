'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, createKaryawanAuthAccount, auth } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-collections';
import { setDocument, updateDocument, deleteDocument } from '@/lib/firestore-helpers';
import Modal from '@/components/dashboard/Modal';
import type { Shift, Outlet, Tunjangan, TunjanganItem, Jabatan } from '@/types';

interface KaryawanRow {
  id: string;
  nama: string;
  email: string;
  noHp: string;
  cabang: string;
  jabatan: string;
  status: string;
  shift: string;
  gajiPokok: number;
  tunjangan: TunjanganItem[];
  jadwalKerja: string[];
  bergabung: string;
  profileComplete: boolean;
}

const STATUS_OPTIONS = ['Aktif', 'Cuti', 'Non-aktif'];
const HARI_OPTIONS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const emptyForm = {
  nama: '',
  email: '',
  password: '',
  noHp: '',
  cabang: '',
  jabatan: '',
  shift: '',
  status: 'Aktif',
  gajiPokok: 0,
  tunjangan: [] as TunjanganItem[],
  jadwalKerja: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as string[],
};

export default function KaryawanPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Semua');
  const [karyawanData, setKaryawanData] = useState<KaryawanRow[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [tunjanganMaster, setTunjanganMaster] = useState<Tunjangan[]>([]);
  const [jabatanMaster, setJabatanMaster] = useState<Jabatan[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KaryawanRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KaryawanRow | null>(null);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<KaryawanRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where('role', '==', 'karyawan')),
      (snap) => {
        const rows: KaryawanRow[] = snap.docs.map((d) => {
          const u = d.data() as {
            nama?: string;
            email?: string;
            noHp?: string;
            cabang?: string;
            jabatan?: string;
            status?: string;
            shift?: string;
            gajiPokok?: number;
            tunjangan?: TunjanganItem[];
            jadwalKerja?: string[];
            createdAt?: { toDate?: () => Date };
            profileComplete?: boolean;
          };
          return {
            id: d.id,
            nama: u.nama || 'Tanpa Nama',
            email: u.email || '—',
            noHp: u.noHp || '',
            cabang: u.cabang || '—',
            jabatan: u.jabatan || '—',
            status: u.status || 'Aktif',
            shift: u.shift || '—',
            gajiPokok: u.gajiPokok || 0,
            tunjangan: Array.isArray(u.tunjangan) ? u.tunjangan : [],
            jadwalKerja: Array.isArray(u.jadwalKerja) ? u.jadwalKerja : [],
            bergabung: u.createdAt?.toDate?.().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) || '—',
            profileComplete: u.profileComplete ?? false,
          };
        });
        rows.sort((a, b) => a.nama.localeCompare(b.nama));
        setKaryawanData(rows);
        setLoading(false);
      },
      (err) => {
        console.error('karyawan listener error:', err);
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

    const unsubTunjangan = onSnapshot(
      query(collection(db, COLLECTIONS.TUNJANGAN), orderBy('nama')),
      (snap) => setTunjanganMaster(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Tunjangan)),
      (err) => console.error('tunjangan listener error:', err)
    );

    const unsubJabatan = onSnapshot(
      query(collection(db, COLLECTIONS.JABATAN), orderBy('nama')),
      (snap) => setJabatanMaster(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Jabatan)),
      (err) => console.error('jabatan listener error:', err)
    );

    return () => {
      unsubUsers();
      unsubShifts();
      unsubOutlets();
      unsubTunjangan();
      unsubJabatan();
    };
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (k: KaryawanRow) => {
    setEditing(k);
    setForm({
      nama: k.nama,
      email: k.email === '—' ? '' : k.email,
      password: '',
      noHp: k.noHp,
      cabang: k.cabang === '—' ? '' : k.cabang,
      jabatan: k.jabatan === '—' ? '' : k.jabatan,
      shift: k.shift === '—' ? '' : k.shift,
      status: k.status,
      gajiPokok: k.gajiPokok,
      tunjangan: k.tunjangan,
      jadwalKerja: k.jadwalKerja.length > 0 ? k.jadwalKerja : [...emptyForm.jadwalKerja],
    });
    setErrors({});
    setModalOpen(true);
  };

  const setField = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.nama.trim()) e.nama = 'Nama wajib diisi';
    if (!editing) {
      if (!form.email.trim()) e.email = 'Email wajib diisi';
      if (form.password.length < 6) e.password = 'Password minimal 6 karakter';
    }
    if (!form.gajiPokok || form.gajiPokok <= 0) e.gajiPokok = 'Gaji pokok wajib diisi';
    if (form.tunjangan.length === 0) e.tunjangan = 'Pilih minimal satu tunjangan';
    if (!form.cabang) e.cabang = 'Cabang wajib dipilih';
    if (!form.jabatan) e.jabatan = 'Jabatan wajib dipilih';
    if (!form.shift) e.shift = 'Shift kerja wajib dipilih';
    if (form.jadwalKerja.length === 0) e.jadwalKerja = 'Pilih minimal satu hari kerja';
    return e;
  };

  const handleSave = async () => {
    const eObj = validate();
    setErrors(eObj);
    if (Object.keys(eObj).length > 0) return;

    if (editing) {
      // Update existing record (account/email not changed here)
      setSaving(true);
      try {
        await updateDocument(COLLECTIONS.USERS, editing.id, {
          nama: form.nama.trim(),
          noHp: form.noHp.trim(),
          cabang: form.cabang,
          jabatan: form.jabatan,
          shift: form.shift,
          status: form.status,
          gajiPokok: Number(form.gajiPokok) || 0,
          tunjangan: form.tunjangan,
          jadwalKerja: form.jadwalKerja,
          profileComplete: !!form.noHp.trim(),
        });
        setModalOpen(false);
      } catch (err) {
        console.error('update karyawan error:', err);
        alert('Gagal memperbarui data karyawan.');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Create new karyawan with login account
    setSaving(true);
    try {
      const uid = await createKaryawanAuthAccount(form.email.trim(), form.password);
      await setDocument(COLLECTIONS.USERS, uid, {
        uid,
        role: 'karyawan',
        nama: form.nama.trim(),
        email: form.email.trim(),
        noHp: form.noHp.trim(),
        cabang: form.cabang,
        jabatan: form.jabatan,
        shift: form.shift,
        status: form.status,
        gajiPokok: Number(form.gajiPokok) || 0,
        tunjangan: form.tunjangan,
        jadwalKerja: form.jadwalKerja,
        // Nomor HP wajib dilengkapi karyawan saat login pertama di app mereka
        profileComplete: !!form.noHp.trim(),
      });
      setModalOpen(false);
    } catch (err: unknown) {
      console.error('create karyawan error:', err);
      const code = (err as { code?: string })?.code;
      if (code === 'auth/email-already-in-use') {
        setErrors((prev) => ({ ...prev, email: 'Email sudah terpakai. Gunakan email lain.' }));
      } else if (code === 'auth/invalid-email') {
        setErrors((prev) => ({ ...prev, email: 'Format email tidak valid.' }));
      } else {
        alert('Gagal membuat akun karyawan.');
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
      console.error('delete karyawan error:', err);
      alert('Gagal menghapus karyawan.');
    } finally {
      setSaving(false);
    }
  };

  const openReset = (k: KaryawanRow) => {
    setResetTarget(k);
    setNewPassword('');
  };

  const handleResetPassword = async () => {
    if (!resetTarget || newPassword.length < 6) return;
    setResetting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        alert('Sesi admin tidak valid. Silakan login ulang.');
        setResetting(false);
        return;
      }
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid: resetTarget.id, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal mengganti password.');
        return;
      }
      alert(`Password ${resetTarget.nama} berhasil diganti. Berikan password baru ini ke karyawan.`);
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      console.error('reset password error:', err);
      alert('Gagal menghubungi server.');
    } finally {
      setResetting(false);
    }
  };

  const filteredData = karyawanData.filter((k) => {
    const matchesSearch =
      k.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.cabang.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'Semua') return matchesSearch;
    return matchesSearch && k.status === activeTab;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Karyawan</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola data karyawan dan shift kerja untuk absensi.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4.5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm shadow-rose-500/10 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Karyawan
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Filters and Search Bar */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="flex gap-1.5 p-1 bg-slate-50 rounded-xl self-start">
            {['Semua', ...STATUS_OPTIONS].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === tab
                    ? 'bg-white text-rose-600 shadow-sm border border-slate-200/40'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

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
              className="w-full pl-9 pr-4 py-2.5 text-xs text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition duration-150"
              placeholder="Cari nama, email, atau cabang..."
            />
          </div>
        </div>

        {/* Table Container (desktop) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                <th className="px-6 py-4">Karyawan</th>
                <th className="px-6 py-4">Jabatan</th>
                <th className="px-6 py-4">Cabang</th>
                <th className="px-6 py-4">Shift Kerja</th>
                <th className="px-6 py-4">Gaji/Bln</th>
                <th className="px-6 py-4">Tunjangan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Memuat data karyawan...
                  </td>
                </tr>
              ) : filteredData.length > 0 ? (
                filteredData.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-xl flex items-center justify-center">
                          {k.nama.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{k.nama}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            {k.email}
                            {!k.profileComplete && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-bold" title="Nomor HP belum dilengkapi">No HP belum diisi</span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Bergabung {k.bergabung}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-600 whitespace-nowrap">{k.jabatan}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">{k.cabang}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {k.shift}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">
                      {k.gajiPokok > 0 ? 'Rp ' + k.gajiPokok.toLocaleString('id-ID') : '—'}
                    </td>
                    <td className="px-6 py-4 font-medium text-emerald-600 whitespace-nowrap">
                      {k.tunjangan.length > 0 ? (
                        <>
                          Rp {k.tunjangan.reduce((s, t) => s + (t.nominal || 0), 0).toLocaleString('id-ID')}
                          <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{k.tunjangan.length} tunjangan</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                          k.status === 'Aktif'
                            ? 'bg-emerald-50 text-emerald-600'
                            : k.status === 'Cuti'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {k.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openReset(k)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                          title="Set password baru"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openEdit(k)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          title="Edit Data"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(k)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Hapus Karyawan"
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
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Belum ada karyawan. Klik &quot;Tambah Karyawan&quot; untuk menambah.
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
              Memuat data karyawan...
            </div>
          ) : filteredData.length > 0 ? (
            filteredData.map((k) => (
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
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                          k.status === 'Aktif'
                            ? 'bg-emerald-50 text-emerald-600'
                            : k.status === 'Cuti'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {k.status}
                      </span>
                    </div>

                    {!k.profileComplete && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-bold">No HP belum diisi</span>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-600">{k.jabatan}</span>
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-600">{k.cabang}</span>
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-600">{k.shift}</span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <p className="text-slate-400">Gaji/Bln</p>
                        <p className="font-semibold text-slate-700">{k.gajiPokok > 0 ? 'Rp ' + k.gajiPokok.toLocaleString('id-ID') : '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Tunjangan</p>
                        <p className="font-semibold text-emerald-600">
                          {k.tunjangan.length > 0 ? 'Rp ' + k.tunjangan.reduce((s, t) => s + (t.nominal || 0), 0).toLocaleString('id-ID') : '—'}
                        </p>
                      </div>
                    </div>

                    <p className="mt-2 text-[10px] text-slate-400">Bergabung {k.bergabung}</p>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => openReset(k)}
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg py-1.5 transition cursor-pointer"
                      >
                        Password
                      </button>
                      <button
                        onClick={() => openEdit(k)}
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg py-1.5 transition cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(k)}
                        className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg py-1.5 transition cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-12 text-center text-slate-400">
              <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Belum ada karyawan. Klik &quot;Tambah Karyawan&quot; untuk menambah.
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-semibold text-slate-500">
          <span>Menampilkan {filteredData.length} dari {karyawanData.length} data karyawan</span>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Karyawan' : 'Tambah Karyawan'}
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nama Karyawan <span className="text-rose-500">*</span></label>
            <input
              type="text"
              autoFocus
              value={form.nama}
              onChange={(e) => setField('nama', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className={`w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border ${errors.nama ? 'border-rose-400' : 'border-slate-250'} rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition`}
              placeholder="Contoh: Budi Santoso"
            />
            {errors.nama && <p className="text-[10px] text-rose-500 mt-1">{errors.nama}</p>}
          </div>

          {!editing && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email (untuk login) <span className="text-rose-500">*</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border ${errors.email ? 'border-rose-400' : 'border-slate-250'} rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition`}
                  placeholder="karyawan@golqi.com"
                />
                {errors.email && <p className="text-[10px] text-rose-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password Awal <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border ${errors.password ? 'border-rose-400' : 'border-slate-250'} rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition`}
                  placeholder="Minimal 6 karakter"
                />
                {errors.password ? (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.password}</p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">Berikan email & password ini ke karyawan untuk login di aplikasi.</p>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Nomor HP <span className="text-slate-400 font-normal">(opsional)</span>
            </label>
            <input
              type="tel"
              value={form.noHp}
              onChange={(e) => setForm({ ...form, noHp: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              placeholder="08xxxxxxxxxx"
            />
            <p className="text-[10px] text-slate-400 mt-1">Jika dikosongkan, karyawan wajib mengisinya saat login pertama.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gaji Pokok / bulan <span className="text-rose-500">*</span></label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm text-slate-400 pointer-events-none">Rp</span>
              <input
                aria-label="Gaji Pokok per bulan"
                type="number"
                min={0}
                value={form.gajiPokok || ''}
                onChange={(e) => setField('gajiPokok', Number(e.target.value))}
                className={`w-full pl-9 pr-3.5 py-2.5 text-sm text-slate-900 bg-white border ${errors.gajiPokok ? 'border-rose-400' : 'border-slate-250'} rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition`}
                placeholder="Contoh: 2500000"
              />
            </div>
            {errors.gajiPokok ? (
              <p className="text-[10px] text-rose-500 mt-1">{errors.gajiPokok}</p>
            ) : (
              <p className="text-[10px] text-slate-400 mt-1">Dipakai sebagai dasar perhitungan penggajian (potongan SP & reward).</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Tunjangan <span className="text-rose-500">*</span> <span className="text-slate-400 font-normal">(bisa lebih dari satu)</span>
            </label>
            <select
              aria-label="Tambah Tunjangan"
              value=""
              onChange={(e) => {
                const t = tunjanganMaster.find((m) => m.id === e.target.value);
                if (t && !form.tunjangan.some((x) => x.nama === t.nama)) {
                  setField('tunjangan', [...form.tunjangan, { nama: t.nama, nominal: t.nominal }]);
                }
              }}
              className={`w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border ${errors.tunjangan ? 'border-rose-400' : 'border-slate-250'} rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition cursor-pointer`}
            >
              <option value="">— Pilih tunjangan untuk ditambahkan —</option>
              {tunjanganMaster
                .filter((t) => !form.tunjangan.some((x) => x.nama === t.nama))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nama} — Rp {t.nominal.toLocaleString('id-ID')}
                  </option>
                ))}
            </select>
            {tunjanganMaster.length === 0 && (
              <p className="text-[10px] text-slate-400 mt-1">Belum ada tunjangan. Tambahkan dulu di menu Tunjangan.</p>
            )}
            {form.tunjangan.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {form.tunjangan.map((t, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                    {t.nama} · Rp {t.nominal.toLocaleString('id-ID')}
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, tunjangan: form.tunjangan.filter((_, i) => i !== idx) })}
                      className="hover:text-emerald-900 cursor-pointer"
                      aria-label={`Hapus ${t.nama}`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                <span className="text-[11px] font-semibold text-slate-500 self-center">
                  Total: Rp {form.tunjangan.reduce((s, t) => s + t.nominal, 0).toLocaleString('id-ID')}
                </span>
              </div>
            )}
            {errors.tunjangan && <p className="text-[10px] text-rose-500 mt-1">{errors.tunjangan}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Penempatan Cabang <span className="text-rose-500">*</span></label>
            <select
              aria-label="Penempatan Cabang"
              value={form.cabang}
              onChange={(e) => setField('cabang', e.target.value)}
              className={`w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border ${errors.cabang ? 'border-rose-400' : 'border-slate-250'} rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition cursor-pointer`}
            >
              <option value="">— Pilih Cabang —</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.nama}>
                  {o.nama}
                </option>
              ))}
            </select>
            {errors.cabang && <p className="text-[10px] text-rose-500 mt-1">{errors.cabang}</p>}
            {outlets.length === 0 && (
              <p className="text-[10px] text-slate-400 mt-1">Belum ada cabang. Tambahkan di menu Cabang / Outlet.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jabatan / Role <span className="text-rose-500">*</span></label>
            <select
              aria-label="Jabatan"
              value={form.jabatan}
              onChange={(e) => setField('jabatan', e.target.value)}
              className={`w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border ${errors.jabatan ? 'border-rose-400' : 'border-slate-250'} rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition cursor-pointer`}
            >
              <option value="">— Pilih Jabatan —</option>
              {jabatanMaster.map((j) => (
                <option key={j.id} value={j.nama}>
                  {j.nama}
                </option>
              ))}
            </select>
            {errors.jabatan && <p className="text-[10px] text-rose-500 mt-1">{errors.jabatan}</p>}
            {jabatanMaster.length === 0 && (
              <p className="text-[10px] text-amber-600 mt-1 font-semibold">Belum ada jabatan. Tambahkan dulu di menu Jabatan / Role sebelum membuat karyawan.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Shift Kerja <span className="text-rose-500">*</span></label>
            <select
              aria-label="Shift Kerja"
              value={form.shift}
              onChange={(e) => setField('shift', e.target.value)}
              className={`w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border ${errors.shift ? 'border-rose-400' : 'border-slate-250'} rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition cursor-pointer`}
            >
              <option value="">— Pilih Shift —</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.nama}>
                  {s.nama} ({s.jamMasuk} - {s.jamKeluar})
                </option>
              ))}
            </select>
            {errors.shift && <p className="text-[10px] text-rose-500 mt-1">{errors.shift}</p>}
            {shifts.length === 0 && (
              <p className="text-[10px] text-slate-400 mt-1">Belum ada shift. Tambahkan di menu Shift Kerja.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Jadwal Kerja <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {HARI_OPTIONS.map((h) => {
                const checked = form.jadwalKerja.includes(h);
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() =>
                      setField(
                        'jadwalKerja',
                        checked ? form.jadwalKerja.filter((d) => d !== h) : [...form.jadwalKerja, h]
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                      checked
                        ? 'bg-rose-50 border-rose-200 text-rose-600'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {h.slice(0, 3)}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">Hari yang karyawan wajib masuk. Di luar ini = libur (tidak dihitung alfa).</p>
            {errors.jadwalKerja && <p className="text-[10px] text-rose-500 mt-1">{errors.jadwalKerja}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
            <select
              aria-label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition cursor-pointer"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Karyawan"
        footer={
          <>
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Menghapus...' : 'Ya, Hapus'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Yakin ingin menghapus <span className="font-bold text-slate-800">{deleteTarget?.nama}</span>? Tindakan ini tidak dapat dibatalkan.
        </p>
      </Modal>

      {/* Reset Password Modal (set langsung) */}
      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Set Password Baru"
        footer={
          <>
            <button
              onClick={() => setResetTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleResetPassword}
              disabled={resetting || newPassword.length < 6}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetting ? 'Menyimpan...' : 'Set Password'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Atur password baru untuk <span className="font-bold text-slate-800">{resetTarget?.nama}</span>. Password langsung berlaku, tanpa email.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password Baru</label>
            <input
              type="text"
              autoFocus
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 transition"
              placeholder="Minimal 6 karakter"
            />
            <p className="text-[10px] text-slate-400 mt-1">Berikan password baru ini langsung ke karyawan.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
