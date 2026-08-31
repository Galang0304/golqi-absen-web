'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import FaceUploader from '@/components/dashboard/FaceUploader';

const SECRET = 'golqi-face-2026';

type Emp = {
  id: string;
  nama: string;
  role: string;
  cabang: string;
  faceTemplates: number[][] | null;
  fotoWajah?: string;
  faceRegisteredAt?: any;
};

export default function HiddenUploadPage() {
  const [authed, setAuthed] = useState(false);
  const [empList, setEmpList] = useState<Emp[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [templates, setTemplates] = useState<number[][] | null>(null);
  const [fotoUrl, setFotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Cek kunci rahasia dari URL (?key=...)
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get('key');
    setAuthed(key === SECRET);
  }, []);

  // Muat semua karyawan & leader
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'users'), orderBy('nama')),
      (snap) => {
        const rows: Emp[] = snap.docs.map((d) => {
          const u = d.data() as any;
          const raw = u.faceTemplates;
          const tpls = Array.isArray(raw)
            ? (raw as number[][])
            : raw && typeof raw === 'object'
              ? (Object.values(raw) as number[][])
              : [];
          return {
            id: d.id,
            nama: u.nama || 'Tanpa Nama',
            role: u.role || 'karyawan',
            cabang: u.cabang || '-',
            faceTemplates: tpls.length > 0 ? tpls : null,
            fotoWajah: u.fotoWajah || '',
            faceRegisteredAt: u.faceRegisteredAt,
          };
        });
        rows.sort((a, b) => a.nama.localeCompare(b.nama));
        setEmpList(rows);
      },
      (err) => console.error('hidden upload load error:', err)
    );
    return () => unsub();
  }, []);

  const selected = empList.find((e) => e.id === selectedId) || null;

  const handleSave = useCallback(async () => {
    if (!selectedId || !templates || templates.length === 0) {
      setMsg('❌ Pilih karyawan & upload foto wajah dulu.');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const map: Record<string, number[]> = {};
      templates.forEach((t, i) => { map[String(i)] = t; });
      await updateDoc(doc(db, 'users', selectedId), {
        faceTemplates: map,
        fotoWajah: fotoUrl || '',
        faceRegisteredAt: new Date(),
        faceRegAllowed: false,
      });
      setMsg(`✅ Wajah ${selected?.nama} berhasil didaftarkan.`);
    } catch (err: any) {
      console.error(err);
      setMsg('❌ Gagal simpan: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  }, [selectedId, templates, fotoUrl, selected?.nama]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
          <div className="text-3xl mb-2">🔒</div>
          <p className="text-slate-500">Akses tidak valid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Upload Foto Wajah (Tersembunyi)</h1>
          <p className="text-sm text-slate-500">Halaman khusus — hanya untuk yang punya link rahasia.</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Pilih Karyawan / Leader</label>
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                const emp = empList.find((x) => x.id === e.target.value);
                setTemplates(emp?.faceTemplates || null);
                setFotoUrl(emp?.fotoWajah || '');
              }}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            >
              <option value="">— Pilih —</option>
              {empList.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nama} ({e.role === 'leader' ? 'Leader' : 'Karyawan'} · {e.cabang})
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              {selected.fotoWajah ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.fotoWajah} alt="Wajah" className="w-12 h-12 rounded-lg object-cover border border-emerald-200" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xl">{selected.nama.charAt(0)}</div>
              )}
              <div>
                <p className="font-semibold text-slate-800">{selected.nama}</p>
                <p className="text-xs text-slate-400">
                  {selected.faceTemplates ? '✓ Sudah terdaftar (akan diganti)' : 'Belum terdaftar'}
                </p>
              </div>
            </div>
          )}

          <FaceUploader
            value={templates}
            fotoUrl={fotoUrl}
            onChange={(t, url) => {
              setTemplates(t);
              if (url) setFotoUrl(url);
            }}
          />

          <button
            onClick={handleSave}
            disabled={saving || !selectedId}
            className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : '💾 Simpan Wajah'}
          </button>

          {msg && <div className="text-xs font-semibold">{msg}</div>}
        </div>
      </div>
    </div>
  );
}
