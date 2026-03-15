'use client';

import type React from 'react';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';

interface UserProfile {
  id: string;
  full_name?: string;
  role?: string;
  is_subscribed?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  fetchUserProfile: (user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = getSupabaseClient();

  const fetchUserProfile = useCallback(
    async (user: User) => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, full_name, role,is_subscribed')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          console.debug('🚀 ~ AuthProvider ~ data:', data);
          setUserProfile(data);
        }
      } catch (error: any) {
        console.error('Error fetching user profile:', error);
      }
    },
    [supabase]
  );

  useEffect(() => {
    const hydrate = async () => {
      // 1) If Supabase redirected you here with ?code=…, turn it into a real session:
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        const {
          data: { session },
          error,
        } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('PKCE code-exchange failed:', error);
        } else {
          if (session) {
            setSession(session);
            setUser(session?.user);
            await fetchUserProfile(session?.user);
          }
        }
        // clean up the URL bar
        window.history.replaceState({}, '', window.location.pathname);
      }

      // 2) Then your normal “getSession() / onAuthStateChange” logic:
      const {
        data: { session: stored },
      } = await supabase.auth.getSession();
      setSession(stored);
      setUser(stored?.user ?? null);
      if (stored?.user) await fetchUserProfile(stored.user);
      setIsLoading(false);
    };

    hydrate();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchUserProfile(session.user);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast({
        title: 'Success',
        description: 'Signed in successfully. Redirecting...',
      });
    } catch (error: any) {
      console.error('Sign in error:', error);
      setAuthError(error.message);
      toast({
        title: 'Sign In Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: 'Sign Out Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Success', description: 'Signed out successfully.' });
      }
      setUser(null);
      setUserProfile(null);
      setSession(null);
      router.push('/');
    } catch (error) {
      console.debug('🚀 ~ signOut ~ error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: 'Password Reset',
        description: 'Check your inbox for a reset link.',
      });
    } catch (error: any) {
      console.error('Reset password error:', error);
      setAuthError(error.message);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async (newPassword: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      toast({
        title: 'Success',
        description: 'Your password has been updated.',
      });

      router.push('/');
    } catch (err: any) {
      console.error('Update password error:', err);
      setAuthError(err.message);
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user)
        throw new Error('Sign up succeeded but no user was returned.');

      toast({
        title: 'Success',
        description: 'Account created. Please check your email to verify.',
      });
      router.push('/login');
    } catch (error: any) {
      console.error('Sign up error:', error);
      setAuthError(error.message);
      toast({
        title: 'Sign Up Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    userProfile,
    session,
    isLoading,
    isAuthenticated: !!user,
    authError,
    signIn,
    signOut,
    signUp,
    forgotPassword,
    updatePassword,
    fetchUserProfile,
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
