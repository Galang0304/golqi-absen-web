'use client';

import { useState } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import MobileNavbar from '@/components/dashboard/MobileNavbar';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300">
        {/* Sidebar (Desktop Permanent / Mobile Slide Drawer) */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content Area */}
        <div className="lg:pl-64 flex flex-col min-h-screen">
          {/* Header (Top Nav) */}
          <Header onMenuClick={() => setSidebarOpen(true)} />

          {/* Page Content */}
          <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8 pb-24 lg:pb-8">
            {children}
          </main>

          {/* Mobile Bottom Navigation Bar */}
          <MobileNavbar onMenuClick={() => setSidebarOpen(true)} />
        </div>
      </div>
    </ProtectedRoute>
  );
}

