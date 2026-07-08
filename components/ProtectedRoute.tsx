'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'hrd')[];
}

export default function ProtectedRoute({
  children,
  allowedRoles = ['admin', 'hrd'],
}: ProtectedRouteProps) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (userData && !allowedRoles.includes(userData.role as any)) {
        router.push('/unauthorized');
      }
    }
  }, [user, userData, loading, router, allowedRoles]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  // Don't render children if user is not authenticated or doesn't have permission
  if (!user || (userData && !allowedRoles.includes(userData.role as any))) {
    return null;
  }

  return <>{children}</>;
}
