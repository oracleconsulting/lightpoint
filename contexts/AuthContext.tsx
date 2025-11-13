'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: any) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // Check active session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await syncUserProfile(session.user);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        
        // Don't do anything if we're in the middle of signing out
        if (isSigningOut) {
          console.log('⏭️ Skipping auth state change - signing out in progress');
          return;
        }
        
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await syncUserProfile(session.user);
        }
        
        // Only refresh if not signing out
        if (event !== 'SIGNED_OUT') {
          router.refresh();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [isSigningOut]);

  const syncUserProfile = async (authUser: User) => {
    try {
      // Check if user exists in lightpoint_users
      const { data: existingUser, error: fetchError } = await supabase
        .from('lightpoint_users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') {
        // User doesn't exist, create profile
        console.log('Creating user profile for:', authUser.email);
        
        const { error: insertError } = await supabase
          .from('lightpoint_users')
          .insert({
            id: authUser.id,
            email: authUser.email!,
            full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
            organization_id: '00000000-0000-0000-0000-000000000001', // Default org
            role: authUser.user_metadata?.role || 'viewer', // Default role
            is_active: true,
          });

        if (insertError) {
          console.error('Failed to create user profile:', insertError);
        }
      } else if (existingUser) {
        console.log('User profile exists:', existingUser.email);
      }
    } catch (error) {
      console.error('Error syncing user profile:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔵 AuthContext: signIn() starting...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('🔴 AuthContext: signIn error:', error);
      throw error;
    }
    
    console.log('✅ AuthContext: signIn successful, user:', data.user?.email);
    
    if (data.user) {
      console.log('🔄 AuthContext: Syncing user profile...');
      await syncUserProfile(data.user);
      console.log('✅ AuthContext: User profile synced');
    }
    
    console.log('🚀 AuthContext: Executing redirect to /dashboard NOW');
    // Use hard redirect to ensure clean navigation
    window.location.href = '/dashboard';
    console.log('⚠️ AuthContext: This line should never execute (redirect should happen first)');
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    
    if (error) throw error;
    
    // Note: User profile will be created when they verify email and sign in
  };

  const signOut = async () => {
    console.log('🔓 AuthContext: Redirecting to /logout page');
    // Just redirect to dedicated logout page - it will handle everything
    window.location.href = '/logout';
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

