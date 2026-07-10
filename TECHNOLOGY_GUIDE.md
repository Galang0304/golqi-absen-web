# Penjelasan Teknologi Sistem Golqi Absen

Dokumen ini menjelaskan teknologi yang digunakan pada APK karyawan/leader dan web admin, beserta lokasi kode yang dapat ditunjukkan saat seminar proposal.

## Ringkasan

| Teknologi | Penggunaan |
|---|---|
| Flutter dan Dart | APK mobile karyawan dan leader |
| Next.js dan React | Dashboard web admin |
| TypeScript | Tipe data dan logika web admin |
| Tailwind CSS | Tampilan dan responsive layout web |
| Cloud Firestore | Database NoSQL realtime |
| Cloudinary | Penyimpanan foto selfie dan profil |
| Google Maps dan Places API | Peta, outlet, geofence, rute, dan pencarian lokasi |
| REST API dan JSON | Komunikasi aplikasi dengan layanan eksternal |

## Flutter dan Dart

Flutter digunakan untuk membuat tampilan APK mobile. Dart digunakan untuk menulis logika login, GPS, absensi, pengajuan, gaji, profil, dan menu Tim leader.

**Path kode:**

- [absenapp/lib/main.dart](../absenapp/lib/main.dart) - entry point Flutter, `MaterialApp`, dan `AuthGate`.
- [absenapp/lib/screens/home_screen.dart](../absenapp/lib/screens/home_screen.dart) - dashboard, jam realtime, peta, rute, dan absensi.
- [absenapp/lib/screens/login_screen.dart](../absenapp/lib/screens/login_screen.dart) - login Firebase Authentication.
- [absenapp/lib/screens/gaji_screen.dart](../absenapp/lib/screens/gaji_screen.dart) - slip gaji dengan Tunjangan, Reward, dan SP.
- [absenapp/lib/services/attendance_service.dart](../absenapp/lib/services/attendance_service.dart) - GPS, jarak, geofence, shift, dan Firestore.
- [absenapp/lib/services/cloudinary_service.dart](../absenapp/lib/services/cloudinary_service.dart) - upload foto melalui API.
- [absenapp/pubspec.yaml](../absenapp/pubspec.yaml) - dependency Flutter.

Contoh Dart untuk login:

```dart
await FirebaseAuth.instance.signInWithEmailAndPassword(
  email: email,
  password: pass,
);
```

**Jawaban sempro:**

> Flutter digunakan sebagai framework aplikasi mobile, sedangkan Dart digunakan sebagai bahasa pemrograman untuk logika login, GPS, validasi radius, absensi, dan pengolahan data.

## Next.js, React, dan TypeScript

Next.js dan React digunakan untuk dashboard web admin. React mengatur komponen serta state interaktif, Next.js mengatur routing dan API route, sedangkan TypeScript memberikan tipe data.

**Path kode:**

- [app/dashboard/page.tsx](app/dashboard/page.tsx) - dashboard admin.
- [app/dashboard/absensi/page.tsx](app/dashboard/absensi/page.tsx) - halaman absensi, React state, TypeScript interface, dan Firestore realtime.
- [app/dashboard/karyawan/page.tsx](app/dashboard/karyawan/page.tsx) - manajemen karyawan.
- [components/dashboard/Sidebar.tsx](components/dashboard/Sidebar.tsx) - navigasi dashboard.
- [types/index.ts](types/index.ts) - tipe data aplikasi.
- [lib/firebase.ts](lib/firebase.ts) - konfigurasi Firebase web.

Contoh TypeScript dan React:

```tsx
interface AbsensiRow {
  id: string;
  userId: string;
  nama: string;
  status: string;
}

const [absensiData, setAbsensiData] = useState<AbsensiRow[]>([]);
```

**Jawaban sempro:**

> Next.js dan React digunakan untuk membangun dashboard web admin, sedangkan TypeScript digunakan agar data karyawan, absensi, outlet, dan pengajuan memiliki tipe yang jelas.

## Tailwind CSS

Tailwind CSS digunakan untuk mengatur warna, layout, spacing, tombol, tabel, sidebar, dan tampilan responsive web admin.

**Path kode:**

- [app/globals.css](app/globals.css) - style global.
- [components/dashboard/Sidebar.tsx](components/dashboard/Sidebar.tsx) - tampilan sidebar.
- [components/dashboard/Header.tsx](components/dashboard/Header.tsx) - tampilan header.
- [app/dashboard/karyawan/page.tsx](app/dashboard/karyawan/page.tsx) - tabel desktop dan kartu mobile.
- [app/dashboard/laporan/page.tsx](app/dashboard/laporan/page.tsx) - responsive laporan.

**Jawaban sempro:**

> Tailwind CSS digunakan untuk membangun tampilan web admin yang konsisten dan responsive pada desktop maupun mobile.

## Cloud Firestore sebagai Database NoSQL

Cloud Firestore digunakan sebagai database utama dalam bentuk collection dan document. Collection yang digunakan antara lain `users`, `absensi`, `pengajuan`, `outlets`, `shifts`, `tunjangan`, `reward`, `surat_peringatan`, `jabatan`, dan `settings`.

**Path kode:**

- [lib/firebase.ts](lib/firebase.ts) - inisialisasi `getFirestore`.
- [lib/firestore-collections.ts](lib/firestore-collections.ts) - daftar collection.
- [lib/firestore-helpers.ts](lib/firestore-helpers.ts) - helper CRUD Firestore.
- [app/dashboard/absensi/page.tsx](app/dashboard/absensi/page.tsx) - `collection`, `query`, dan `onSnapshot` absensi realtime.
- [../absenapp/lib/services/attendance_service.dart](../absenapp/lib/services/attendance_service.dart) - baca dan simpan data dari APK.

Contoh listener realtime web:

```tsx
onSnapshot(
  query(collection(db, COLLECTIONS.ABSENSI), ...),
  (snap) => {
    // Data berubah otomatis ketika Firestore diperbarui.
  }
);
```

**Jawaban sempro:**

> Cloud Firestore digunakan sebagai database NoSQL realtime untuk menyimpan user, absensi, outlet, shift, pengajuan, tunjangan, Reward, dan SP. APK dan web menggunakan database yang sama.

## Cloudinary

Cloudinary digunakan untuk menyimpan foto selfie absensi dan foto profil. Hasil upload berupa URL gambar yang digunakan pada aplikasi dan dapat disimpan ke Firestore.

**Path kode:**

- [../absenapp/lib/services/cloudinary_service.dart](../absenapp/lib/services/cloudinary_service.dart) - upload selfie dari APK.
- [../absenapp/lib/services/attendance_service.dart](../absenapp/lib/services/attendance_service.dart) - pemanggilan upload pada `clockIn()`.
- [lib/cloudinary.ts](lib/cloudinary.ts) - konfigurasi dan helper Cloudinary web.
- [app/api/upload/route.ts](app/api/upload/route.ts) - API upload foto web.
- [components/CloudinaryImage.tsx](components/CloudinaryImage.tsx) - menampilkan gambar Cloudinary.

**Jawaban sempro:**

> Cloudinary digunakan sebagai penyimpanan gambar untuk foto selfie absensi dan foto profil. URL hasil upload digunakan kembali oleh sistem.

## Google Maps Platform: Maps dan Places API

Pada APK, package `google_maps_flutter` digunakan untuk peta, marker user, marker toko, lingkaran radius, dan garis rute.

**Path APK:**

- [../absenapp/pubspec.yaml](../absenapp/pubspec.yaml) - dependency `google_maps_flutter`.
- [../absenapp/lib/screens/home_screen.dart](../absenapp/lib/screens/home_screen.dart) - `GoogleMap`, `Marker`, `Circle`, `Polyline`, dan `GoogleMapController`.
- [../absenapp/lib/services/attendance_service.dart](../absenapp/lib/services/attendance_service.dart) - GPS dan `Geolocator.distanceBetween()`.

Pada web, Maps JavaScript API dan Places API digunakan untuk memilih lokasi outlet dan mencari alamat.

**Path web:**

- [components/dashboard/MapPicker.tsx](components/dashboard/MapPicker.tsx) - `importLibrary('maps')`, `importLibrary('marker')`, dan `importLibrary('places')`.
- [app/dashboard/cabang/page.tsx](app/dashboard/cabang/page.tsx) - pengaturan outlet.

**Jawaban sempro:**

> Google Maps digunakan untuk menampilkan lokasi, marker, radius geofence, dan rute. Places API digunakan untuk mencari alamat outlet melalui autocomplete.

## REST API dan JSON

REST API digunakan untuk komunikasi HTTP dengan layanan eksternal, terutama Cloudinary. JSON digunakan sebagai format pertukaran data.

**Path kode:**

- [../absenapp/lib/services/cloudinary_service.dart](../absenapp/lib/services/cloudinary_service.dart) - request `POST` multipart ke Cloudinary dan `jsonDecode()`.
- [app/api/upload/route.ts](app/api/upload/route.ts) - API route Next.js `POST`.
- [app/api/reset-password/route.ts](app/api/reset-password/route.ts) - API reset password.

Contoh JSON pada APK:

```dart
final data = jsonDecode(body) as Map<String, dynamic>;
return data['secure_url'] as String;
```

Contoh response JSON pada web:

```tsx
return NextResponse.json(result);
```

**Jawaban sempro:**

> REST API digunakan sebagai perantara komunikasi berbasis HTTP, misalnya untuk upload foto. JSON digunakan untuk membaca dan mengirim data seperti `secure_url` hasil upload Cloudinary.

## Urutan File Saat Demo Sempro

1. [../absenapp/lib/main.dart](../absenapp/lib/main.dart) - awal aplikasi Flutter.
2. [../absenapp/lib/screens/login_screen.dart](../absenapp/lib/screens/login_screen.dart) - autentikasi APK.
3. [../absenapp/lib/services/attendance_service.dart](../absenapp/lib/services/attendance_service.dart) - GPS, radius, absensi, dan Firestore.
4. [../absenapp/lib/services/cloudinary_service.dart](../absenapp/lib/services/cloudinary_service.dart) - REST API dan JSON.
5. [lib/firebase.ts](lib/firebase.ts) - Firebase web.
6. [app/dashboard/absensi/page.tsx](app/dashboard/absensi/page.tsx) - React, TypeScript, dan Firestore realtime.
7. [components/dashboard/MapPicker.tsx](components/dashboard/MapPicker.tsx) - Google Maps dan Places API.
8. [app/api/upload/route.ts](app/api/upload/route.ts) - API route Next.js dan Cloudinary.

## Jawaban Singkat Saat Ditanya Dosen

> Flutter dan Dart digunakan untuk membangun APK karyawan dan leader. Next.js, React, TypeScript, dan Tailwind CSS digunakan untuk membangun web admin. Cloud Firestore digunakan sebagai database NoSQL realtime untuk menyimpan data user, absensi, outlet, shift, pengajuan, tunjangan, Reward, dan SP. Cloudinary digunakan untuk menyimpan foto selfie absensi dan foto profil. Google Maps dan Places API digunakan untuk peta, lokasi outlet, pencarian alamat, marker, radius geofence, dan rute. REST API dan JSON digunakan sebagai media komunikasi aplikasi dengan layanan eksternal seperti Cloudinary.
