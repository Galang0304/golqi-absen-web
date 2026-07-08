import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

/**
 * Firebase Admin SDK (server-side only).
 * Needs a service account. Set FIREBASE_SERVICE_ACCOUNT_KEY in .env.local
 * to the full service account JSON (single line) downloaded from
 * Firebase Console > Project Settings > Service accounts > Generate new private key.
 */
let app: App | null = null;

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY belum diatur di .env.local');
  }

  const serviceAccount = JSON.parse(raw);
  app = initializeApp({
    credential: cert(serviceAccount),
  });
  return app;
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}
