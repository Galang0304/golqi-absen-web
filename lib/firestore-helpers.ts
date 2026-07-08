import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import { COLLECTIONS } from './firestore-collections';

// Generic CRUD Operations

export async function createDocument<T>(
  collectionName: string,
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
) {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

/**
 * Create/overwrite a document with a specific ID (e.g. Firebase Auth uid).
 */
export async function setDocument(
  collectionName: string,
  documentId: string,
  data: Record<string, unknown>
) {
  const now = Timestamp.now();
  await setDoc(doc(db, collectionName, documentId), {
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return documentId;
}

export async function getDocument<T>(
  collectionName: string,
  documentId: string
): Promise<T | null> {
  const docRef = doc(db, collectionName, documentId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as T;
  }
  return null;
}

export async function updateDocument(
  collectionName: string,
  documentId: string,
  data: Record<string, any>
) {
  const docRef = doc(db, collectionName, documentId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteDocument(
  collectionName: string,
  documentId: string
) {
  const docRef = doc(db, collectionName, documentId);
  await deleteDoc(docRef);
}

export async function getDocuments<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  const q = query(collection(db, collectionName), ...constraints);
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[];
}

// Specific helpers for common queries

export async function getUserByEmail(email: string) {
  const users = await getDocuments(
    COLLECTIONS.USERS,
    [where('email', '==', email), limit(1)]
  );
  return users[0] || null;
}

export async function getAbsensiByDate(userId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const absensiList = await getDocuments(
    COLLECTIONS.ABSENSI,
    [
      where('userId', '==', userId),
      where('tanggal', '>=', Timestamp.fromDate(startOfDay)),
      where('tanggal', '<=', Timestamp.fromDate(endOfDay)),
      limit(1)
    ]
  );
  
  return absensiList[0] || null;
}

export async function getPendingPengajuan() {
  return getDocuments(
    COLLECTIONS.PENGAJUAN,
    [
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    ]
  );
}

export async function getUnreadNotifications(userId: string) {
  return getDocuments(
    COLLECTIONS.NOTIFICATIONS,
    [
      where('userId', '==', userId),
      where('isRead', '==', false),
      orderBy('createdAt', 'desc')
    ]
  );
}

export async function getAbsensiToday() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  
  return getDocuments(
    COLLECTIONS.ABSENSI,
    [
      where('tanggal', '>=', Timestamp.fromDate(startOfDay)),
      where('tanggal', '<=', Timestamp.fromDate(endOfDay)),
    ]
  );
}
