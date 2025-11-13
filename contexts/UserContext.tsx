'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/Provider';

interface User {
  id: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'manager' | 'analyst' | 'viewer';
  organization_id: string;
  job_title?: string;
  phone?: string;
  is_active: boolean;
}

interface UserContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isAdmin: boolean;
  isManager: boolean;
  canManageUsers: boolean;
  canEditComplaint: (complaint: any) => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Load user from localStorage on mount (or you can fetch from API)
  useEffect(() => {
    const storedUser = localStorage.getItem('lightpoint_current_user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse stored user:', e);
      }
    }
  }, []);

  // Save to localStorage when user changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('lightpoint_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('lightpoint_current_user');
    }
  }, [currentUser]);

  const isAdmin = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager' || isAdmin;
  const canManageUsers = isAdmin || isManager;

  const canEditComplaint = (complaint: any) => {
    if (!currentUser) return false;
    if (isAdmin) return true; // Admin can edit anything
    if (complaint.assigned_to === currentUser.id) return true; // Assigned user
    if (complaint.created_by === currentUser.id) return true; // Creator
    return false;
  };

  return (
    <UserContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isAdmin,
        isManager,
        canManageUsers,
        canEditComplaint,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

