'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import FaceUploader from '@/components/dashboard/FaceUploader';

const SECRET = 'golqi-face-2026';

type Emp = {
  id: string;
  nama: string;
  role: string;
  cabang: string;
  jabatan: string;
  faceTemplates: number[][] | null;
  fotoWajah?: string;
  faceRegisteredAt?: any;
};

export default function HiddenUploadPage() {
  const [authed, setAuthed] = useState(false);
  const [empList, setEmpList] = useState<Emp[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'semua' | 'karyawan' | 'leader'>('semua');
  const [selectedId, setSelectedId] = useState('');
  const [templates, setTemplates] = useState<number[][] | null>(null);
  const [fotoUrl, setFotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get('key');
    setAuthed(key === SECRET);
  }, []);

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
            jabatan: u.jabatan || '',
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return empList.filter((e) => {
      if (roleFilter !== 'semua' && e.role !== roleFilter) return false;
      if (q && !e.nama.toLowerCase().includes(q) && !e.cabang.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [empList, search, roleFilter]);

  const stats = useMemo(() => {
    const total = empList.length;
    const regis = empList.filter((e) => e.faceTemplates).length;
    return { total, regis };
  }, [empList]);

  const selected = empList.find((e) => e.id === selectedId) || null;

  const handleSelect = (e: Emp) => {
    setSelectedId(e.id);
    setTemplates(e.faceTemplates || null);
    setFotoUrl(e.fotoWajah || '');
    setMsg(null);
  };

  const handleSave = useCallback(async () => {
    if (!selectedId || !templates || templates.length === 0) {
      setMsg({ type: 'err', text: 'Pilih karyawan & upload foto wajah dulu.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const map: Record<string, number[]> = {};
      templates.forEach((t, i) => { map[String(i)] = t; });
      await updateDoc(doc(db, 'users', selectedId), {
        faceTemplates: map,
        fotoWajah: fotoUrl || '',
        faceRegisteredAt: new Date(),
        faceRegAllowed: false,
      });
      setMsg({ type: 'ok', text: `✅ Wajah ${selected?.nama} berhasil didaftarkan.` });
    } catch (err: any) {
      console.error(err);
      setMsg({ type: 'err', text: '❌ Gagal simpan: ' + (err.message || '') });
    } finally {
      setSaving(false);
    }
  }, [selectedId, templates, fotoUrl, selected?.nama]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="bg-white/95 p-10 rounded-3xl shadow-2xl text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-slate-600 font-semibold">Akses tidak valid.</p>
          <p className="text-slate-400 text-sm mt-1">Halaman ini dilindungi.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-rose-700 to-rose-500 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">📸</div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Upload Foto Wajah</h1>
              <p className="text-xs text-white/70">Halaman khusus admin</p>
            </div>
          </div>
          <div className="text-right text-xs">
            <div className="font-bold text-white/90">{stats.regis}/{stats.total} terdaftar</div>
            <div className="text-white/60">✓ {stats.regis} · ✗ {stats.total - stats.regis}</div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Daftar karyawan */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama / cabang..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
              <div className="flex gap-1.5">
                {(['semua', 'karyawan', 'leader'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      roleFilter === r
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {r === 'semua' ? 'Semua' : r === 'karyawan' ? 'Karyawan' : 'Leader'}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[560px] overflow-y-auto divide-y divide-slate-100">
              {filtered.length === 0 && (
                <div className="p-10 text-center text-slate-400 text-sm">Tidak ada data.</div>
              )}
              {filtered.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleSelect(e)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition cursor-pointer hover:bg-rose-50/50 ${
                    selectedId === e.id ? 'bg-rose-50 border-l-4 border-rose-600' : 'border-l-4 border-transparent'
                  }`}
                >
                  <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {e.fotoWajah ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.fotoWajah} alt="Wajah" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-slate-400 font-bold">{e.nama.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{e.nama}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {e.role === 'leader' ? 'Leader' : 'Karyawan'} · {e.cabang}
                    </p>
                  </div>
                  {e.faceTemplates ? (
                    <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold whitespace-nowrap">✓ Terdaftar</span>
                  ) : (
                    <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-500 text-[10px] font-bold whitespace-nowrap">Belum</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Panel upload */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h2 className="font-bold text-slate-800 text-sm">Foto Wajah Karyawan</h2>

              {selected ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0">
                    {selected.fotoWajah ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selected.fotoWajah} alt="Wajah" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl">{selected.nama.charAt(0)}</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{selected.nama}</p>
                    <p className="text-xs text-slate-400">
                      {selected.role === 'leader' ? 'Leader' : 'Karyawan'} · {selected.cabang}
                    </p>
                    <p className={`text-[11px] font-semibold ${selected.faceTemplates ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {selected.faceTemplates ? '✓ Sudah terdaftar (upload untuk ganti)' : 'Belum terdaftar'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm">
                  Pilih karyawan dari daftar untuk upload foto wajah
                </div>
              )}

              {selected && (
                <>
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
                    disabled={saving}
                    className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-rose-500/20"
                  >
                    {saving ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Menyimpan...
                      </span>
                    ) : (
                      '💾 Simpan Wajah'
                    )}
                  </button>

                  {msg && (
                    <div className={`px-4 py-3 rounded-xl text-xs font-semibold ${
                      msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {msg.text}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
