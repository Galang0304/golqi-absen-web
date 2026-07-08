import { Timestamp } from 'firebase/firestore';

// User Types
export type UserRole = 'admin' | 'hrd' | 'karyawan';

export interface User {
  uid: string;
  email: string;
  nama: string;
  role: UserRole;
  nip?: string;
  noHp?: string;
  departemen?: string;
  cabang?: string;
  shift?: string;
  status?: string;
  jabatan?: string;
  gajiPokok?: number;
  tunjangan?: TunjanganItem[];
  jadwalKerja?: string[]; // array hari: 'senin','selasa','rabu','kamis','jumat','sabtu','minggu'
  profileComplete?: boolean;
  fotoProfile?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Outlet / Cabang Types
export interface Outlet {
  id: string;
  nama: string;
  alamat?: string;
  latitude?: number;
  longitude?: number;
  radius?: number; // radius zona absen dalam meter
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Tunjangan Types
export interface Tunjangan {
  id: string;
  nama: string;
  nominal: number;
  keterangan?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Tunjangan yang menempel pada karyawan (snapshot nama + nominal)
export interface TunjanganItem {
  nama: string;
  nominal: number;
}

// Jabatan / Role Types (mis. Kitchen, Kasir)
export interface Jabatan {
  id: string;
  nama: string;
  keterangan?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Surat Peringatan (SP) Types
export type JenisSP = 'teguran' | 'sp1' | 'sp2' | 'sp3';

export interface SuratPeringatan {
  id: string;
  userId: string;
  userNama: string;
  cabang?: string;
  jenis: JenisSP;
  nominal: number; // potongan gaji pokok dalam rupiah
  alasan: string;
  tanggal: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Reward Types
export interface Reward {
  id: string;
  userId: string;
  userNama: string;
  cabang?: string;
  kategori?: string;
  nominal: number; // bonus/reward dalam rupiah
  alasan: string;
  tanggal: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Shift Types
export interface Shift {
  id: string;
  nama: string;
  jamMasuk: string; // Format: "HH:mm"
  jamKeluar: string; // Format: "HH:mm"
  toleransiTerlambat: number; // dalam menit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Absensi Types
export type StatusAbsensi = 'hadir' | 'terlambat' | 'tidak_hadir';

export interface Absensi {
  id: string;
  userId: string;
  userNama: string;
  userNip?: string;
  tanggal: Timestamp;
  shift: string;
  
  // Clock In
  clockIn?: Timestamp;
  fotoClockIn?: string;
  lokasiClockIn?: {
    latitude: number;
    longitude: number;
  };
  
  // Clock Out
  clockOut?: Timestamp;
  fotoClockOut?: string;
  lokasiClockOut?: {
    latitude: number;
    longitude: number;
  };
  
  status: StatusAbsensi;
  keterangan?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Pengajuan Cuti/Izin Types
export type JenisPengajuan = 'cuti' | 'izin' | 'sakit';
export type StatusPengajuan = 'pending' | 'disetujui' | 'ditolak';

export interface Pengajuan {
  id: string;
  userId: string;
  userNama: string;
  userNip?: string;
  
  jenis: JenisPengajuan;
  tanggalMulai: Timestamp;
  tanggalSelesai: Timestamp;
  alasan: string;
  dokumenPendukung?: string[]; // URLs of uploaded documents
  
  status: StatusPengajuan;
  reviewedBy?: string; // HRD user ID
  reviewedByNama?: string;
  reviewedAt?: Timestamp;
  alasanPenolakan?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Notification Types
export type NotificationType = 'pengajuan_baru' | 'pengajuan_disetujui' | 'pengajuan_ditolak' | 'reminder_absen';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedId?: string; // ID of related document (e.g., pengajuan ID)
  createdAt: Timestamp;
}

// Dashboard Statistics Types
export interface DashboardStats {
  totalKaryawan: number;
  hadirHariIni: number;
  terlambatHariIni: number;
  tidakHadirHariIni: number;
  pendingApproval: number;
}
