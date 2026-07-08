'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-collections';
import { updateDocument } from '@/lib/firestore-helpers';
import { useAuth } from '@/contexts/AuthContext';
import type { Pengajuan } from '@/types';

const jenisLabel: Record<string, string> = { cuti: 'Cuti', izin: 'Izin', sakit: 'Sakit' };
const TABS = ['pending', 'disetujui', 'ditolak'] as const;
const tabLabel: Record<string, string> = { pending: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' };

export default function PengajuanPage() {
  const { userData } = useAuth();
  const [items, setItems] = useState<Pengajuan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, COLLECTIONS.PENGAJUAN), orderBy('createdAt', 'desc')),
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Pengajuan));
        setLoading(false);
      },
      (err) => {
        console.error('pengajuan listener error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleReview = async (id: string, status: 'disetujui' | 'ditolak') => {
    setProcessing(id);
    try {
      await updateDocument(COLLECTIONS.PENGAJUAN, id, {
        status,
        reviewedBy: userData?.uid || '',
        reviewedByNama: userData?.nama || 'Admin',
        reviewedAt: Timestamp.now(),
      });
    } catch (err) {
      console.error('review pengajuan error:', err);
      alert('Gagal memproses pengajuan.');
    } finally {
      setProcessing(null);
    }
  };

  const fmtDate = (ts?: Timestamp) =>
    ts?.toDate?.().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—';

  const filtered = items.filter((p) => p.status === activeTab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Kelola Pengajuan Cuti/Izin</h1>
        <p className="text-sm text-slate-500 mt-1">Setujui atau tolak permohonan izin, cuti, dan sakit karyawan.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl self-start w-fit">
        {TABS.map((tab) => {
          const count = items.filter((p) => p.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                activeTab === tab ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tabLabel[tab]}
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === tab ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-semibold text-slate-700">Tidak Ada Pengajuan {tabLabel[activeTab]}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 font-bold flex items-center justify-center flex-shrink-0">
                    {(p.userNama || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800">{p.userNama || 'Karyawan'}</p>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                        {jenisLabel[p.jenis] ?? p.jenis}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{p.alasan}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {fmtDate(p.tanggalMulai)} — {fmtDate(p.tanggalSelesai)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {p.status === 'pending' ? (
                    <>
                      <button
                        onClick={() => handleReview(p.id, 'ditolak')}
                        disabled={processing === p.id}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
                      >
                        Tolak
                      </button>
                      <button
                        onClick={() => handleReview(p.id, 'disetujui')}
                        disabled={processing === p.id}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                      >
                        {processing === p.id ? '...' : 'Setujui'}
                      </button>
                    </>
                  ) : (
                    <span
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider ${
                        p.status === 'disetujui' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {p.status === 'disetujui' ? 'Disetujui' : 'Ditolak'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
