/**
 * Firestore Collections Reference
 * 
 * Struktur Database:
 * 
 * - users/
 *   └── {userId}
 * 
 * - shifts/
 *   └── {shiftId}
 * 
 * - absensi/
 *   └── {absensiId}
 * 
 * - pengajuan/
 *   └── {pengajuanId}
 * 
 * - notifications/
 *   └── {notificationId}
 */

export const COLLECTIONS = {
  USERS: 'users',
  SHIFTS: 'shifts',
  ABSENSI: 'absensi',
  PENGAJUAN: 'pengajuan',
  NOTIFICATIONS: 'notifications',
  OUTLETS: 'outlets',
  SP: 'surat_peringatan',
  REWARD: 'reward',
  TUNJANGAN: 'tunjangan',
  JABATAN: 'jabatan',
  SETTINGS: 'settings',
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];
