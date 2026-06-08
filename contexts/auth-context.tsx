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
import {
  captureClientEvent,
  identifyClientUser,
  resetClientAnalytics,
} from '@/lib/analytics/client';
import { analyticsEvents } from '@/lib/analytics/events';
import type { User, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';

interface UserProfile {
  id: string;
  full_name?: string;
  role?: string;
  is_subscribed?: boolean | string | number | null;
  paypal_order_product?: string | null;
}

const AUTH_BOOT_TIMEOUT_MS = 8000;
const AUTH_COOKIE_WAIT_TIMEOUT_MS = 5000;

function hasSupabaseAuthCookie() {
  if (typeof document === 'undefined') return false;

  return document.cookie
    .split(';')
    .some((cookie) => {
      const normalized = cookie.trim();
      return normalized.startsWith('sb-') || normalized.startsWith('__Host-sb-');
    });
}

async function waitForSupabaseAuthCookie(timeoutMs: number = AUTH_COOKIE_WAIT_TIMEOUT_MS) {
  if (typeof document === 'undefined') return false;

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (hasSupabaseAuthCookie()) {
      return true;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  return hasSupabaseAuthCookie();
}

async function withAuthTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error(`${label} timed out after ${AUTH_BOOT_TIMEOUT_MS}ms`));
      }, AUTH_BOOT_TIMEOUT_MS);
    }),
  ]);
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    redirectTo?: string
  ) => Promise<void>;
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
          .select('id, full_name, role, is_subscribed, paypal_order_product')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
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
      try {
        // If Supabase redirected here with ?code=..., exchange it without letting
        // the whole app stay in a permanent loading state on failure or timeout.
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          const {
            data: { session },
            error,
          } = await withAuthTimeout(
            supabase.auth.exchangeCodeForSession(code),
            'Auth code exchange'
          );
          if (error) {
            console.error('PKCE code-exchange failed:', error);
          } else if (session) {
            setSession(session);
            setUser(session.user);
            await fetchUserProfile(session.user);
          }
          window.history.replaceState({}, '', window.location.pathname);
        }

        const {
          data: { session: stored },
        } = await withAuthTimeout(supabase.auth.getSession(), 'Auth session lookup');
        setSession(stored);
        setUser(stored?.user ?? null);
        if (stored?.user) {
          await fetchUserProfile(stored.user);
        }
      } catch (error: any) {
        console.error('Auth hydration error:', error);
        setAuthError('Authentication is taking longer than expected. You can still try signing in.');
      } finally {
        setIsLoading(false);
      }
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
  }, [fetchUserProfile, supabase]);

  useEffect(() => {
    if (user) {
      identifyClientUser(user.id, {
        email: user.email || null,
        full_name: userProfile?.full_name || null,
        role: userProfile?.role || null,
        subscribed: Boolean(userProfile?.is_subscribed),
      });
      return;
    }

    resetClientAnalytics();
  }, [
    user,
    userProfile?.full_name,
    userProfile?.is_subscribed,
    userProfile?.role,
  ]);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        await fetchUserProfile(data.session.user);
        await waitForSupabaseAuthCookie();
        captureClientEvent(analyticsEvents.authSignInSucceeded, {
          email_domain: email.split('@')[1] || 'unknown',
        });
      }
      toast({
        title: 'Success',
        description: 'Signed in successfully. Redirecting...',
      });
      return true;
    } catch (error: any) {
      console.error('Sign in error:', error);
      setAuthError(error.message);
      toast({
        title: 'Sign In Error',
        description: error.message,
        variant: 'destructive',
      });
      return false;
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
        captureClientEvent(analyticsEvents.authSignOutCompleted);
      }
      setUser(null);
      setUserProfile(null);
      setSession(null);
      router.push('/');
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: 'Sign Out Error',
        description: error?.message || 'Unable to sign out cleanly.',
        variant: 'destructive',
      });
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

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    redirectTo?: string
  ) => {
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

      try {
        const postSignupResponse = await fetch('/api/auth/post-signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            fullName,
            userId: authData.user.id,
          }),
        });

        if (!postSignupResponse.ok) {
          console.warn(
            'Post-signup growth system provisioning failed:',
            await postSignupResponse.text()
          );
        }
      } catch (postSignupError) {
        console.warn('Post-signup growth system request failed:', postSignupError);
      }

      captureClientEvent(analyticsEvents.authSignUpCompleted, {
        email_domain: email.split('@')[1] || 'unknown',
        redirect_to: redirectTo || '/login',
      });

      toast({
        title: 'Success',
        description: 'Account created. Your Growth System is being prepared now.',
      });
      router.push(redirectTo || '/login');
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
