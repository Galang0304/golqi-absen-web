# 📱 Sistem Absensi Web Admin

Web Admin untuk sistem manajemen absensi karyawan berbasis selfie dengan approval workflow HRD.

## 🚀 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Backend**: Firebase
  - Authentication (Email/Password)
  - Firestore Database
  - Storage (Foto selfie & dokumen)
- **State Management**: React Context API

## 📋 Fitur

### ✅ Sudah Dibuat (Phase 1)
- [x] Setup Next.js dengan TypeScript
- [x] Firebase SDK integration
- [x] Authentication system (Login, Logout, Forgot Password)
- [x] Protected routes dengan role-based access
- [x] Dashboard layout dengan sidebar navigation
- [x] Header dengan user dropdown menu
- [x] Responsive design (mobile & desktop)
- [x] Firestore & Storage security rules
- [x] TypeScript types untuk semua data model

### 🚧 Belum Dibuat (Phase 2 & 3)
- [ ] Halaman Manajemen Absensi
  - [ ] List absensi dengan filter & search
  - [ ] Detail absensi dengan foto selfie
  - [ ] Export laporan
- [ ] Halaman Pengajuan Cuti/Izin
  - [ ] List pengajuan dengan status
  - [ ] Approve/reject pengajuan
  - [ ] Upload & view dokumen pendukung
- [ ] Halaman Manajemen Karyawan
  - [ ] CRUD karyawan
  - [ ] Assign shift ke karyawan
- [ ] Halaman Manajemen Shift
  - [ ] CRUD shift
  - [ ] Atur jam masuk/keluar & toleransi
- [ ] Halaman Laporan
  - [ ] Grafik kehadiran
  - [ ] Export ke Excel/PDF
- [ ] Real-time notifications
- [ ] Dashboard statistics dari Firestore

## 📁 Struktur Project

```
absen-web-admin/
├── app/
│   ├── dashboard/          # Dashboard pages
│   │   ├── absensi/       # Manajemen absensi
│   │   ├── pengajuan/     # Kelola pengajuan
│   │   ├── karyawan/      # Manajemen karyawan
│   │   ├── shift/         # Manajemen shift
│   │   ├── laporan/       # Laporan kehadiran
│   │   ├── profile/       # Profil user
│   │   ├── settings/      # Pengaturan
│   │   ├── layout.tsx     # Dashboard layout
│   │   └── page.tsx       # Dashboard home
│   ├── login/             # Login page
│   ├── forgot-password/   # Forgot password page
│   ├── unauthorized/      # Unauthorized access page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home (redirect)
├── components/
│   ├── dashboard/
│   │   ├── Sidebar.tsx    # Sidebar navigation
│   │   └── Header.tsx     # Header dengan user menu
│   └── ProtectedRoute.tsx # Route protection HOC
├── contexts/
│   └── AuthContext.tsx    # Authentication context
├── lib/
│   ├── firebase.ts        # Firebase initialization
│   ├── firestore-collections.ts  # Collection names
│   ├── firestore-helpers.ts      # Firestore CRUD helpers
│   └── storage-helpers.ts        # Storage upload helpers
├── types/
│   └── index.ts           # TypeScript types
├── hooks/                 # Custom hooks (empty)
├── utils/                 # Utility functions (empty)
├── firestore.rules        # Firestore security rules
├── storage.rules          # Storage security rules
├── .env.local            # Environment variables
├── FIREBASE_SETUP.md     # Firebase setup guide
└── middleware.ts         # Next.js middleware
```

## 🛠️ Setup & Installation

### 1. Clone Repository

```bash
cd absen-web-admin
```

### 2. Install Dependencies

```bash
npm install
```

**IMPORTANT**: Install Firebase SDK:
```bash
npm install firebase
```

### 3. Setup Firebase

Ikuti panduan lengkap di [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)

**Ringkasan:**
1. Buat Firebase project di [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password)
3. Create Firestore Database
4. Create Storage bucket
5. Upload security rules (firestore.rules & storage.rules)
6. Copy Firebase config ke `.env.local`

### 4. Configure Environment Variables

Edit file `.env.local` dan isi dengan Firebase config Anda:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 5. Run Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

## 👥 User Roles

- **Admin**: Full access ke semua fitur
- **HRD**: Approve/reject pengajuan, view absensi, manage karyawan
- **Karyawan**: (Mobile app only) Clock in/out, ajukan cuti/izin

**Note**: Web admin hanya bisa diakses oleh Admin dan HRD.

## 🗄️ Database Schema

### Collections

#### `users`
```typescript
{
  uid: string;
  email: string;
  nama: string;
  role: 'admin' | 'hrd' | 'karyawan';
  nip?: string;
  departemen?: string;
  shift?: string;
  fotoProfile?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `shifts`
```typescript
{
  id: string;
  nama: string;
  jamMasuk: string;      // "HH:mm"
  jamKeluar: string;     // "HH:mm"
  toleransiTerlambat: number; // menit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `absensi`
```typescript
{
  id: string;
  userId: string;
  tanggal: Timestamp;
  shift: string;
  clockIn?: Timestamp;
  fotoClockIn?: string;
  clockOut?: Timestamp;
  fotoClockOut?: string;
  status: 'hadir' | 'terlambat' | 'tidak_hadir';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `pengajuan`
```typescript
{
  id: string;
  userId: string;
  jenis: 'cuti' | 'izin' | 'sakit';
  tanggalMulai: Timestamp;
  tanggalSelesai: Timestamp;
  alasan: string;
  dokumenPendukung?: string[];
  status: 'pending' | 'disetujui' | 'ditolak';
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  alasanPenolakan?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 🔐 Security

- Authentication required untuk semua halaman (kecuali login)
- Role-based access control (RBAC)
- Firestore security rules untuk data protection
- Storage security rules untuk file validation
- Password reset via email

## 🎨 UI/UX

- Modern & clean interface
- Responsive design (mobile-first)
- Smooth transitions & animations
- Intuitive navigation
- Dark mode ready (Tailwind CSS)

## 📝 Next Steps

1. **Install Firebase SDK** di terminal:
   ```bash
   npm install firebase
   ```

2. **Setup Firebase Project** mengikuti [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)

3. **Test Login**:
   - Buat user di Firebase Console > Authentication
   - Set role HRD/Admin di Firestore > users collection
   - Login ke web admin

4. **Develop Features**:
   - Mulai dari halaman Absensi
   - Lalu Pengajuan Cuti/Izin
   - Kemudian Manajemen Karyawan & Shift
   - Terakhir Laporan

## 🤝 Contributing

Project ini masih dalam tahap development. Untuk menambahkan fitur baru, buat branch baru dari `main`.

## 📄 License

Private project - All rights reserved

---

**Developed with ❤️ using Next.js & Firebase**
