import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify caller is authenticated admin
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 });
    }

    let auth;
    try {
      auth = adminAuth();
    } catch (e) {
      console.error('admin init error:', e);
      return NextResponse.json(
        { error: 'Server belum dikonfigurasi (FIREBASE_SERVICE_ACCOUNT_KEY).' },
        { status: 500 }
      );
    }

    const decoded = await auth.verifyIdToken(token);
    const callerDoc = await getFirestore().collection('users').doc(decoded.uid).get();
    const callerRole = callerDoc.data()?.role;
    if (callerRole !== 'admin' && callerRole !== 'hrd') {
      return NextResponse.json({ error: 'Akses ditolak. Khusus admin/HRD.' }, { status: 403 });
    }

    // 2. Validate payload
    const { uid, newPassword } = await req.json();
    if (!uid || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter.' }, { status: 400 });
    }

    // 3. Set the new password directly
    await auth.updateUser(uid, { password: newPassword });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('reset-password error:', err);
    return NextResponse.json({ error: 'Gagal mengganti password.' }, { status: 500 });
  }
}
