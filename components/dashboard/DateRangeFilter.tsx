'use client';

import { useState, useRef, useEffect } from 'react';

export interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function toInput(d: Date) {
  return d.toISOString().slice(0, 10);
}
function fmt(d: Date) {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export default function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [fromStr, setFromStr] = useState(toInput(value.start));
  const [toStr, setToStr] = useState(toInput(value.end));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFromStr(toInput(value.start));
    setToStr(toInput(value.end));
  }, [value.start, value.end]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const applyPreset = (preset: string) => {
    const now = new Date();
    let start = startOfDay(now);
    let end = endOfDay(now);
    if (preset === 'today') {
      // already today
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      start = startOfDay(y);
      end = endOfDay(y);
    } else if (preset === '7d') {
      const s = new Date(now);
      s.setDate(now.getDate() - 6);
      start = startOfDay(s);
    } else if (preset === '30d') {
      const s = new Date(now);
      s.setDate(now.getDate() - 29);
      start = startOfDay(s);
    } else if (preset === 'month') {
      start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    }
    onChange({ start, end });
    setOpen(false);
  };

  const applyCustom = () => {
    const s = startOfDay(new Date(fromStr));
    const e = endOfDay(new Date(toStr));
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
    onChange({ start: s > e ? e : s, end: e < s ? s : e });
    setOpen(false);
  };

  const label = sameDay(value.start, value.end) ? fmt(value.start) : `${fmt(value.start)} — ${fmt(value.end)}`;

  const presets = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'yesterday', label: 'Kemarin' },
    { key: '7d', label: '7 Hari' },
    { key: '30d', label: '30 Hari' },
    { key: 'month', label: 'Bulan Ini' },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
      >
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {label}
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-50 text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="space-y-2.5 border-t border-slate-100 pt-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Dari</label>
              <input
                aria-label="Tanggal mulai"
                type="date"
                value={fromStr}
                onChange={(e) => setFromStr(e.target.value)}
                className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Sampai</label>
              <input
                aria-label="Tanggal akhir"
                type="date"
                value={toStr}
                onChange={(e) => setToStr(e.target.value)}
                className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500 transition"
              />
            </div>
            <button
              onClick={applyCustom}
              className="w-full py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer"
            >
              Terapkan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
