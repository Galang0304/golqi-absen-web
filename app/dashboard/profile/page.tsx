'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updatePassword, updateEmail, updateProfile } from 'firebase/auth';
import { updateDocument } from '@/lib/firestore-helpers';
import { COLLECTIONS } from '@/lib/firestore-collections';

export default function ProfilePage() {
  const { user, userData } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nama, setNama] = useState(userData?.nama || '');
  const [email, setEmail] = useState(userData?.email || '');
  const [password, setPassword] = useState('');
  const [foto, setFoto] = useState(userData?.fotoProfile || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', `golqi-absensi/profiles/${user.uid}`);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload gagal');
      setFoto(data.secure_url);
    } catch (err) {
      console.error('upload foto error:', err);
      setMessage({ type: 'err', text: 'Gagal mengunggah foto.' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!nama.trim()) {
      setMessage({ type: 'err', text: 'Nama wajib diisi.' });
      return;
    }
    if (password && password.length < 6) {
      setMessage({ type: 'err', text: 'Password minimal 6 karakter.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      // Firestore doc
      await updateDocument(COLLECTIONS.USERS, user.uid, {
        nama: nama.trim(),
        email: email.trim(),
        fotoProfile: foto || '',
      });
      // Auth email
      if (email.trim() && email.trim() !== user.email) {
        await updateEmail(user, email.trim());
      }
      // Auth password
      if (password) {
        await updatePassword(user, password);
      }
      // Auth profile
      await updateProfile(user, { displayName: nama.trim(), photoURL: foto || null });

      setMessage({ type: 'ok', text: 'Profil berhasil diperbarui.' });
      setPassword('');
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: unknown) {
      console.error('save profile error:', err);
      const code = (err as { code?: string })?.code;
      if (code === 'auth/requires-recent-login') {
        setMessage({ type: 'err', text: 'Untuk ubah email/password, silakan logout lalu login ulang, kemudian coba lagi.' });
      } else if (code === 'auth/email-already-in-use') {
        setMessage({ type: 'err', text: 'Email sudah dipakai akun lain.' });
      } else {
        setMessage({ type: 'err', text: 'Gagal menyimpan profil.' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Profil Saya</h1>
        <p className="text-sm text-slate-500 mt-1">Ubah foto, nama, email, dan password akun Anda.</p>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 space-y-6">
        {/* Foto */}
        <div className="flex items-center gap-5">
          <div className="w-24 h-24 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="Foto profil" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-rose-600">{(nama || 'U').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" aria-label="Unggah foto profil" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
            >
              {uploading ? 'Mengunggah...' : 'Ubah Foto'}
            </button>
            {foto && (
              <button
                onClick={() => setFoto('')}
                className="ml-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              >
                Hapus
              </button>
            )}
            <p className="text-[10px] text-slate-400 mt-1.5">Format gambar, maksimal 5 Mb.</p>
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nama</label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              placeholder="Nama lengkap"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              placeholder="email@golqi.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password Baru <span className="text-slate-400 font-normal">(kosongkan jika tidak diubah)</span></label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              placeholder="Minimal 6 karakter"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role</label>
            <input
              type="text"
              aria-label="Role"
              value={(userData?.role || 'admin').toUpperCase()}
              disabled
              className="w-full px-3.5 py-2.5 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl cursor-not-allowed"
            />
          </div>
        </div>

        {message && (
          <div className={`text-xs font-semibold px-3.5 py-2.5 rounded-xl ${message.type === 'ok' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {message.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  );
}
