# Flowchart Sistem Golqi Absensi

## 1. Flowchart APK Karyawan dan Leader

```mermaid
flowchart TD
    A([Buka APK]) --> B{Sudah login?}
    B -- Tidak --> C[Halaman Login]
    C --> D{Email dan password valid?}
    D -- Tidak --> C1[Tampilkan error] --> C
    D -- Ya --> E[Ambil profil user dari Firestore]
    B -- Ya --> E
    E --> F{Profil lengkap dan nomor HP terisi?}
    F -- Tidak --> G[Halaman Profil wajib]
    G --> G1[Lengkapi dan simpan profil] --> E
    F -- Ya --> H[Beranda]
    H --> I{Pilih menu}
    I --> J[Beranda / Absensi]
    I --> K[Riwayat]
    I --> L[Pengajuan]
    I --> M[Gaji]
    I --> N[Profil]
    I --> O{Role leader?}
    O -- Ya --> P[Tim]
    O -- Tidak --> H
    J --> J1[Jam realtime dan status absensi]
    J1 --> J2[Ambil GPS dan data outlet]
    J2 --> J3{Dalam radius outlet?}
    J3 -- Tidak --> J4[Tampilkan peta, toko, radius, dan rute]
    J4 --> J5[Lihat Lokasi Toko] --> J2
    J3 -- Ya --> J6[Ambil selfie]
    J6 --> J7[Upload selfie ke Cloudinary]
    J7 --> J8[Tentukan hadir atau terlambat]
    J8 --> J9[Simpan absen masuk ke Firestore]
    K --> K1[Tampilkan riwayat absensi]
    L --> L1[Pilih cuti, izin, atau sakit]
    L1 --> L2[Simpan pengajuan ke Firestore]
    M --> M1[Ambil tunjangan, Reward, dan SP]
    M1 --> M2[Tampilkan slip gaji]
    P --> P1[Atur shift dan hari kerja karyawan di outlet leader]
    P1 --> P2[Simpan jadwal ke Firestore]
    N --> N1[Lihat atau ubah profil]
```

## 2. Flowchart Web Admin dan HRD

```mermaid
flowchart TD
    A([Buka Web Admin]) --> B{Sudah login?}
    B -- Tidak --> C[Halaman Login]
    C --> D{Firebase Authentication valid?}
    D -- Tidak --> C1[Tampilkan error] --> C
    D -- Ya --> E[Validasi ProtectedRoute dan role]
    B -- Ya --> E
    E --> F{Role admin atau HRD?}
    F -- Tidak --> G[Halaman Unauthorized]
    F -- Ya --> H[Dashboard]
    H --> I{Pilih menu}
    I --> J[Dashboard: statistik dan grafik]
    I --> K[Absensi: filter, detail, dan ekspor CSV]
    I --> L[Pengajuan: review, setujui, atau tolak]
    I --> M[Manajemen SDM]
    M --> M1[Karyawan, Leader, Jabatan / Role]
    M1 --> M2[CRUD data dan akun Firebase]
    I --> N[Operasional]
    N --> N1[Cabang / Outlet: GPS dan radius]
    N --> N2[Shift Kerja: jam masuk dan toleransi]
    I --> O[Keuangan dan Laporan]
    O --> O1[Tunjangan]
    O --> O2[Penggajian: Tunjangan + Reward - SP]
    O --> O3[Laporan Kehadiran dan ekspor CSV]
    I --> P[Penilaian Kinerja]
    P --> P1[Surat Peringatan]
    P --> P2[Reward]
    J --> Q[Data realtime dari Cloud Firestore]
    K --> Q
    L --> Q
    M2 --> Q
    N1 --> Q
    N2 --> Q
    O1 --> Q
    O2 --> Q
    O3 --> Q
    P1 --> Q
    P2 --> Q
```

Buka file ini di VS Code lalu tekan `Ctrl+Shift+V` untuk melihat diagram. GitHub juga dapat merender Mermaid secara otomatis.
