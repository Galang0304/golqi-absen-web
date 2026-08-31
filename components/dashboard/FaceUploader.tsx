'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    tflite: any;
    FilesetResolver: any;
    FaceDetector: any;
    tf: any;
  }
}

type Props = {
  value: number[][] | null;        // faceTemplates yang sudah ada
  fotoUrl?: string;                // foto wajah yang sudah di-upload
  onChange: (templates: number[][] | null, fotoUrl?: string) => void;
  disabled?: boolean;
};

let modelPromise: Promise<any> | null = null;

async function ensureEngine() {
  if (!modelPromise) {
    modelPromise = (async () => {
      if (typeof window.tflite === 'undefined') {
        await loadScript('/vendor/tf.min.js');
        await loadScript('/vendor/tf-tflite.min.js');
      }
      if (!window.FilesetResolver || !window.FaceDetector) {
        await loadModule('/vendor/vision-loader.js');
        await waitFor(() => !!(window.FilesetResolver && window.FaceDetector), 15000);
      }
      const vision = await window.FilesetResolver.forVisionTasks('/vendor/wasm');
      let faceDetector: any;
      try {
        faceDetector = await window.FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/vendor/blaze_face.tflite', delegate: 'GPU' },
          runningMode: 'IMAGE',
        });
      } catch {
        faceDetector = await window.FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/vendor/blaze_face.tflite', delegate: 'CPU' },
          runningMode: 'IMAGE',
        });
      }
      window.tflite.setWasmPath('/vendor/');
      const model = await window.tflite.loadTFLiteModel('/vendor/mobilefacenet.tflite');
      return { faceDetector, model };
    })();
  }
  return modelPromise;
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Gagal load ' + src));
    document.head.appendChild(s);
  });
}

function loadModule(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.type = 'module';
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Gagal load module ' + src));
    document.head.appendChild(s);
  });
}

function waitFor(fn: () => boolean, timeout: number) {
  return new Promise<void>((resolve, reject) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (fn()) { clearInterval(iv); resolve(); }
      else if (Date.now() - t0 > timeout) { clearInterval(iv); reject(new Error('Timeout')); }
    }, 200);
  });
}

function expandBox(srcW: number, srcH: number, box: { originX: number; originY: number; width: number; height: number }, factor: number) {
  const cx = box.originX + box.width / 2;
  const cy = box.originY + box.height / 2;
  let w = box.width * factor;
  let h = box.height * factor;
  let x = cx - w / 2;
  let y = cy - h / 2;
  x = Math.max(0, x);
  y = Math.max(0, y);
  if (x + w > srcW) w = srcW - x;
  if (y + h > srcH) h = srcH - y;
  return { x, y, w, h };
}

async function embeddingFromImage(img: HTMLImageElement, engine: { faceDetector: any; model: any }) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const c = canvas.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(img, 0, 0);
  const dets = await engine.faceDetector.detect(canvas);
  if (!dets.detections || dets.detections.length === 0) {
    throw new Error('Tidak terdeteksi wajah di foto.');
  }
  const box = dets.detections[0].boundingBox;
  const crop = expandBox(canvas.width, canvas.height, box, 1.5);

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = 112;
  cropCanvas.height = 112;
  const cc = cropCanvas.getContext('2d', { willReadFrequently: true })!;
  cc.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, 112, 112);
  const imageData = cc.getImageData(0, 0, 112, 112).data;

  const input = new Float32Array(112 * 112 * 3);
  for (let i = 0; i < 112 * 112; i++) {
    input[i * 3] = (imageData[i * 4] - 127.5) / 128.0;
    input[i * 3 + 1] = (imageData[i * 4 + 1] - 127.5) / 128.0;
    input[i * 3 + 2] = (imageData[i * 4 + 2] - 127.5) / 128.0;
  }
  const tensor = window.tf.tensor4d(input, [1, 112, 112, 3]);
  const output = await engine.model.predict(tensor);
  const embedding = Array.from(await output.data());
  tensor.dispose();
  output.dispose();
  return embedding as number[];
}

export default function FaceUploader({ value, fotoUrl, onChange, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<any>(null);

  useEffect(() => {
    // Siapkan engine di background agar upload nanti instan
    ensureEngine().then((e) => { engineRef.current = e; }).catch((err) => console.warn('face engine:', err.message));
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setBusy(true);
    setStatus('Memproses wajah...');
    try {
      const engine = engineRef.current || (await ensureEngine());
      engineRef.current = engine;
      const img = await loadImage(file);
      const embedding = await embeddingFromImage(img, engine);
      // Simpan 1 template (admin upload 1 pose)
      let fotoUrl = '';
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'golqi-absensi/wajah');
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok && data.secure_url) fotoUrl = data.secure_url;
      } catch (upErr) {
        console.warn('gagal upload foto:', upErr);
      }
      onChange([embedding], fotoUrl);
      setPreview(URL.createObjectURL(file));
      setStatus('✅ Wajah terdeteksi & terdaftar');
    } catch (err: any) {
      console.error(err);
      onChange(null);
      setPreview(null);
      setStatus('❌ ' + (err.message || 'Gagal memproses foto. Coba foto lain yang lebih jelas.'));
    } finally {
      setBusy(false);
    }
  };

  const removeFace = () => {
    onChange(null);
    setPreview(null);
    setStatus('Template wajah dihapus.');
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-600">Foto Wajah (1 pose)</div>
          <div className="text-[10px] text-slate-400">Wajah harus terlihat jelas, menghadap kamera, cahaya cukup.</div>
        </div>
        {value && value.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">✓ Terdaftar ({value.length} template)</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Wajah" className="w-full h-full object-cover" />
          ) : fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoUrl} alt="Wajah terdaftar" className="w-full h-full object-cover" />
          ) : value && value.length > 0 ? (
            <span className="text-2xl">😀</span>
          ) : (
            <span className="text-slate-300 text-xs text-center px-1">Belum ada</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy || disabled}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition disabled:opacity-50"
          >
            {busy ? 'Memproses...' : value && value.length > 0 ? 'Ganti Foto' : '📷 Upload Foto'}
          </button>
          {value && value.length > 0 && (
            <button type="button" onClick={removeFace} disabled={busy} className="text-[10px] text-rose-500 hover:underline text-left">
              Hapus template
            </button>
          )}
        </div>
      </div>

      {status && <div className="text-[11px] text-slate-500">{status}</div>}
    </div>
  );
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gagal membaca gambar')); };
    img.src = url;
  });
}
