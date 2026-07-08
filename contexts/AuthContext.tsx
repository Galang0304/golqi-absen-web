'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { User } from '@/types';
import { getDocument } from '@/lib/firestore-helpers';
import { COLLECTIONS } from '@/lib/firestore-collections';

interface AuthContextType {
  user: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Fetch user data from Firestore with timeout
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout fetching user data')), 5000)
          );
          
          const userDocPromise = getDocument<User>(
            COLLECTIONS.USERS,
            firebaseUser.uid
          );
          
          const userDoc = await Promise.race([userDocPromise, timeoutPromise]) as User | null;
          
          if (userDoc) {
            setUserData(userDoc);
          } else {
            // If no user document, create a minimal one from auth data
            console.warn('No user document found, using auth data');
            setUserData({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              nama: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              role: 'admin', // Default role
              createdAt: null as any,
              updatedAt: null as any,
            });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          // Use fallback data from Firebase Auth
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            nama: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            role: 'admin',
            createdAt: null as any,
            updatedAt: null as any,
          });
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      
      // Fetch user data to check role
      const userDoc = await getDocument<User>(
        COLLECTIONS.USERS,
        userCredential.user.uid
      );
      
      if (!userDoc) {
        throw new Error('User data not found');
      }
      
      // Check if user is HRD or Admin
      if (userDoc.role !== 'hrd' && userDoc.role !== 'admin') {
        await firebaseSignOut(auth);
        throw new Error('Akses ditolak. Hanya HRD dan Admin yang bisa login.');
      }
      
      setUserData(userDoc);
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setUserData(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  const value = {
    user,
    userData,
    loading,
    signIn,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
