'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-collections';
import DateRangeFilter, { DateRange } from '@/components/dashboard/DateRangeFilter';
import type { User, SuratPeringatan, Reward, TunjanganItem } from '@/types';

const rupiah = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');
const rupiahShort = (n: number) => {
  if (n >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(1) + 'jt';
  if (n >= 1_000) return 'Rp ' + Math.round(n / 1_000) + 'rb';
  return 'Rp ' + n;
};

function monthRange(): DateRange {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

interface Slip {
  id: string;
  nama: string;
  cabang: string;
  gajiPokok: number;
  tunjangan: number;
  potonganSP: number;
  reward: number;
  total: number;
}

export default function PenggajianPage() {
  const [karyawan, setKaryawan] = useState<(User & { id: string })[]>([]);
  const [spList, setSpList] = useState<SuratPeringatan[]>([]);
  const [rewardList, setRewardList] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>(monthRange());

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, COLLECTIONS.USERS), where('role', '==', 'karyawan')),
      (snap) => {
        setKaryawan(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as User & { id: string }));
        setLoading(false);
      },
      (err) => {
        console.error('users listener error:', err);
        setLoading(false);
      }
    );
    return () => unsubUsers();
  }, []);

  useEffect(() => {
    const unsubSp = onSnapshot(
      query(
        collection(db, COLLECTIONS.SP),
        where('tanggal', '>=', Timestamp.fromDate(range.start)),
        where('tanggal', '<=', Timestamp.fromDate(range.end))
      ),
      (snap) => setSpList(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SuratPeringatan)),
      (err) => console.error('sp listener error:', err)
    );
    const unsubReward = onSnapshot(
      query(
        collection(db, COLLECTIONS.REWARD),
        where('tanggal', '>=', Timestamp.fromDate(range.start)),
        where('tanggal', '<=', Timestamp.fromDate(range.end))
      ),
      (snap) => setRewardList(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reward)),
      (err) => console.error('reward listener error:', err)
    );
    return () => {
      unsubSp();
      unsubReward();
    };
  }, [range]);

  const slips = useMemo<Slip[]>(() => {
    return karyawan
      .map((k) => {
        const tunjangan = Array.isArray(k.tunjangan)
          ? (k.tunjangan as TunjanganItem[]).reduce((s, t) => s + (t.nominal || 0), 0)
          : 0;
        const potonganSP = spList.filter((s) => s.userId === k.id).reduce((s, x) => s + (x.nominal || 0), 0);
        const reward = rewardList.filter((r) => r.userId === k.id).reduce((s, x) => s + (x.nominal || 0), 0);
        const gajiPokok = k.gajiPokok || 0;
        const total = gajiPokok + tunjangan - potonganSP + reward;
        return {
          id: k.id,
          nama: k.nama || 'Tanpa Nama',
          cabang: k.cabang || '—',
          gajiPokok,
          tunjangan,
          potonganSP,
          reward,
          total,
        };
      })
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [karyawan, spList, rewardList]);

  const totals = useMemo(
    () => ({
      gajiPokok: slips.reduce((s, x) => s + x.gajiPokok, 0),
      tunjangan: slips.reduce((s, x) => s + x.tunjangan, 0),
      potonganSP: slips.reduce((s, x) => s + x.potonganSP, 0),
      reward: slips.reduce((s, x) => s + x.reward, 0),
      total: slips.reduce((s, x) => s + x.total, 0),
    }),
    [slips]
  );

  const perCabang = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of slips) map.set(s.cabang, (map.get(s.cabang) || 0) + s.total);
    return Array.from(map.entries()).map(([cabang, total]) => ({ cabang, total }));
  }, [slips]);

  const monthLabel = useMemo(() => {
    const f = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return range.start.toDateString() === range.end.toDateString() ? f(range.start) : `${f(range.start)} - ${f(range.end)}`;
  }, [range]);

  const handleExport = () => {
    const header = ['Nama', 'Cabang', 'Gaji Pokok', 'Tunjangan', 'Potongan SP', 'Reward', 'Total'];
    const rows = slips.map((s) => [s.nama, s.cabang, s.gajiPokok, s.tunjangan, s.potonganSP, s.reward, s.total]);
    rows.push(['TOTAL', '', totals.gajiPokok, totals.tunjangan, totals.potonganSP, totals.reward, totals.total]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `penggajian-${monthLabel.replace(/ /g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const BAR_COLORS = ['#e11d48', '#f59e0b', '#6366f1', '#10b981', '#8b5cf6', '#ec4899'];

  const summaryCards = [
    { label: 'Total Gaji Pokok', value: totals.gajiPokok, color: 'text-slate-800' },
    { label: 'Total Tunjangan', value: totals.tunjangan, color: 'text-emerald-600' },
    { label: 'Total Potongan SP', value: totals.potonganSP, color: 'text-rose-600' },
    { label: 'Total Reward', value: totals.reward, color: 'text-indigo-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Penggajian & Laporan Bisnis</h1>
          <p className="text-sm text-slate-500 mt-1">Rangkuman total gaji yang harus dikeluarkan per periode.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter value={range} onChange={setRange} />
          <button
            onClick={handleExport}
            disabled={slips.length === 0}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition shadow-sm shadow-rose-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* Grand total banner */}
      <div className="bg-gradient-to-r from-rose-600 to-rose-500 rounded-2xl p-6 text-white shadow-lg shadow-rose-500/20">
        <p className="text-xs font-semibold uppercase tracking-wider text-rose-100">Total Gaji Dikeluarkan — {monthLabel}</p>
        <p className="text-4xl font-extrabold mt-2">{rupiah(totals.total)}</p>
        <p className="text-xs text-rose-100 mt-1">{slips.length} karyawan · Gaji pokok + tunjangan − potongan SP + reward</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((c) => (
          <div key={c.label} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{c.label}</p>
            <p className={`text-xl font-extrabold mt-2 ${c.color}`}>{rupiah(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Chart: total per cabang */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
        <h2 className="text-base font-bold text-slate-800 mb-4">Total Penggajian per Cabang</h2>
        {perCabang.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">Belum ada data.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perCabang} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="cabang" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={rupiahShort} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip formatter={(v) => rupiah(Number(v))} cursor={{ fill: '#fef2f2' }} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {perCabang.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[820px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Karyawan</th>
                <th className="px-6 py-4">Cabang</th>
                <th className="px-6 py-4 text-right">Gaji Pokok</th>
                <th className="px-6 py-4 text-right">Tunjangan</th>
                <th className="px-6 py-4 text-right">Potongan SP</th>
                <th className="px-6 py-4 text-right">Reward</th>
                <th className="px-6 py-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Memuat data penggajian...
                  </td>
                </tr>
              ) : slips.length > 0 ? (
                slips.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-xl flex items-center justify-center">
                          {s.nama.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-semibold text-slate-800">{s.nama}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{s.cabang}</td>
                    <td className="px-6 py-4 text-right text-slate-700">{rupiah(s.gajiPokok)}</td>
                    <td className="px-6 py-4 text-right text-emerald-600">{s.tunjangan ? '+' + rupiah(s.tunjangan) : '—'}</td>
                    <td className="px-6 py-4 text-right text-rose-600">{s.potonganSP ? '−' + rupiah(s.potonganSP) : '—'}</td>
                    <td className="px-6 py-4 text-right text-indigo-600">{s.reward ? '+' + rupiah(s.reward) : '—'}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-800">{rupiah(s.total)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Belum ada karyawan untuk dihitung.
                  </td>
                </tr>
              )}
            </tbody>
            {slips.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 text-xs font-bold text-slate-800">
                  <td className="px-6 py-4" colSpan={2}>TOTAL</td>
                  <td className="px-6 py-4 text-right">{rupiah(totals.gajiPokok)}</td>
                  <td className="px-6 py-4 text-right text-emerald-600">{rupiah(totals.tunjangan)}</td>
                  <td className="px-6 py-4 text-right text-rose-600">{rupiah(totals.potonganSP)}</td>
                  <td className="px-6 py-4 text-right text-indigo-600">{rupiah(totals.reward)}</td>
                  <td className="px-6 py-4 text-right text-rose-700">{rupiah(totals.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Card list (mobile) */}
        <div className="lg:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="px-4 py-12 text-center text-slate-400">
              <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Memuat data penggajian...
            </div>
          ) : slips.length > 0 ? (
            <>
              {slips.map((s) => (
                <div key={s.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-50 border border-rose-100 text-rose-600 font-bold rounded-xl flex items-center justify-center flex-shrink-0">
                      {s.nama.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{s.nama}</p>
                          <p className="text-[11px] text-slate-400 truncate">{s.cabang}</p>
                        </div>
                        <span className="text-[13px] font-bold text-slate-800 whitespace-nowrap">{rupiah(s.total)}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        <div className="flex justify-between"><span className="text-slate-400">Pokok</span><span className="text-slate-700 font-medium">{rupiah(s.gajiPokok)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Tunjangan</span><span className="text-emerald-600 font-medium">{s.tunjangan ? '+' + rupiah(s.tunjangan) : '—'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Potongan SP</span><span className="text-rose-600 font-medium">{s.potonganSP ? '−' + rupiah(s.potonganSP) : '—'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Reward</span><span className="text-indigo-600 font-medium">{s.reward ? '+' + rupiah(s.reward) : '—'}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="p-4 bg-slate-50 flex items-center justify-between">
                <span className="text-[13px] font-bold text-slate-800">TOTAL</span>
                <span className="text-[15px] font-bold text-rose-700">{rupiah(totals.total)}</span>
              </div>
            </>
          ) : (
            <div className="px-4 py-12 text-center text-slate-400">Belum ada karyawan untuk dihitung.</div>
          )}
        </div>
      </div>
    </div>
  );
}
