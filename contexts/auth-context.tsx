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
import {
  getSafeAuthReturnPath,
  normalizeAuthIntent,
  normalizeMemberRoles,
  type MemberRole,
} from '@/lib/auth/intent';

interface UserProfile {
  id: string;
  full_name?: string;
  role?: string;
  member_roles?: MemberRole[];
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
  signUp: (input: {
    email: string;
    password: string;
    fullName: string;
    memberRoles?: readonly string[];
    next?: string | null;
    intent?: string | null;
  }) => Promise<{ ok: boolean; verificationRequired: boolean }>;
  forgotPassword: (email: string, next?: string | null) => Promise<boolean>;
  updatePassword: (newPassword: string, next?: string | null) => Promise<boolean>;
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
          .select('id, full_name, role, member_roles, is_subscribed, paypal_order_product')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data) {
          setUserProfile({
            id: data.id,
            full_name: data.full_name ?? undefined,
            role: data.role ?? undefined,
            member_roles: normalizeMemberRoles(data.member_roles),
            is_subscribed: data.is_subscribed,
            paypal_order_product: data.paypal_order_product,
          });
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
        const {
          data: { session: stored },
        } = await withAuthTimeout(supabase.auth.getSession(), 'Auth session lookup');
        if (stored) {
          const {
            data: { user: verifiedUser },
          } = await withAuthTimeout(supabase.auth.getUser(), 'Auth user verification');
          setSession(verifiedUser ? stored : null);
          setUser(verifiedUser);
          if (verifiedUser) await fetchUserProfile(verifiedUser);
        } else {
          setSession(null);
          setUser(null);
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

  const forgotPassword = async (email: string, next?: string | null) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          getSafeAuthReturnPath(next, '/reset-password')
        )}&intent=recovery`,
      });
      if (error) throw error;
      toast({
        title: 'Password Reset',
        description: 'Check your inbox for a reset link.',
      });
      return true;
    } catch (error: any) {
      console.error('Reset password error:', error);
      setAuthError(error.message);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async (newPassword: string, next?: string | null) => {
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

      router.push(getSafeAuthReturnPath(next, '/dashboard/services'));
      return true;
    } catch (err: any) {
      console.error('Update password error:', err);
      setAuthError(err.message);
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp: AuthContextType['signUp'] = async ({
    email,
    password,
    fullName,
    memberRoles,
    next,
    intent,
  }) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const safeNext = getSafeAuthReturnPath(next);
      const safeIntent = normalizeAuthIntent(intent);
      const safeMemberRoles = normalizeMemberRoles(memberRoles);
      const callback = new URL('/auth/callback', window.location.origin);
      callback.searchParams.set('next', safeNext);
      if (safeIntent) callback.searchParams.set('intent', safeIntent);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callback.toString(),
          data: {
            full_name: fullName,
            member_roles: safeMemberRoles,
            signup_intent: safeIntent,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user)
        throw new Error('Sign up succeeded but no user was returned.');

      if (authData.session) try {
        if (safeMemberRoles.length > 0) {
          const { error: roleError } = await supabase
            .from('user_profiles')
            .update({ member_roles: safeMemberRoles })
            .eq('id', authData.user.id);
          if (roleError) console.warn('Member role setup failed:', roleError.message);
        }

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
        redirect_to: safeNext,
        verification_required: !authData.session,
      });

      toast({
        title: 'Success',
        description: authData.session
          ? 'Account created. Your VestBlock workspace is ready.'
          : 'Account created. Check your email to verify and continue.',
      });
      return { ok: true, verificationRequired: !authData.session };
    } catch (error: any) {
      console.error('Sign up error:', error);
      setAuthError(error.message);
      toast({
        title: 'Sign Up Error',
        description: error.message,
        variant: 'destructive',
      });
      return { ok: false, verificationRequired: false };
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
