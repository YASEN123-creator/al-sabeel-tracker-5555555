'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { safeParseJsonResult } from './storage';
import { useAppStore } from './store';
import { isLocalDemoRequested, LOCAL_DEMO_USER_ID } from './demoMode';
import { isSupabaseConfigured as hasSupabaseConfig } from './supabaseConfig';

interface OfflineUser {
  id: string;
  email?: string | null;
  name?: string;
  created_at?: string;
}

function isOfflineUser(value: unknown): value is OfflineUser {
  return typeof value === 'object' && value !== null &&
    typeof (value as { id?: unknown }).id === 'string';
}

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return hasSupabaseConfig(url, key);
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function translateError(msg: string): string {
  if (!msg) return 'حدث خطأ غير متوقع';
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many') || msg.includes('over_request_rate_limit')) {
    return 'تم تجاوز عدد المحاولات. استنى دقيقة وحاول مرة أخرى.';
  }
  if (msg.includes('Invalid login credentials') || msg.includes('Invalid email or password')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'البريد الإلكتروني غير مؤكد.';
  }
  if (msg.includes('User already registered')) {
    return 'هذا البريد الإلكتروني مسجل بالفعل.';
  }
  if (msg.includes('Password should be at least')) {
    return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
  }
  if (msg.includes('For security reasons')) {
    return 'تم تجاوز عدد المحاولات. استنى 30-60 دقيقة وحاول مرة أخرى.';
  }
  if (msg.includes('Network') || msg.includes('fetch') || msg.includes('Failed to fetch')) {
    return 'مشكلة في الاتصال بالإنترنت.';
  }
  return msg.length > 120 ? 'حدث خطأ. تأكد من البيانات وحاول مرة أخرى.' : msg;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const commitAuthUser = useCallback((nextUser: User | null) => {
    const store = useAppStore.getState();
    const nextUserId = nextUser?.id ?? null;
    const nextUserEmail = nextUser?.email ?? null;
    if (store.userId !== nextUserId) {
      // Clear the previous account synchronously before React can render the
      // newly authenticated identity with stale user-specific state.
      store.switchUser(nextUserId, nextUserEmail);
    } else if (store.userEmail !== nextUserEmail) {
      store.setUserEmail(nextUserEmail);
    }
    setUser(nextUser);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      let active = true;
      queueMicrotask(() => {
        if (!active) return;
        try {
          if (isLocalDemoRequested()) {
            commitAuthUser({
              id: LOCAL_DEMO_USER_ID, email: null, aud: 'authenticated', role: 'authenticated',
              app_metadata: {}, user_metadata: { name: 'Demo' }, created_at: new Date().toISOString(),
            } as User);
          } else {
            const savedUser = localStorage.getItem('sabeel_offline_user');
            const parseResult = safeParseJsonResult<OfflineUser | null>(savedUser, null, (value) => value === null || isOfflineUser(value));
            const parsed = parseResult.value;
            if (parsed) {
              const fakeUser = {
                id: parsed.id, email: parsed.email || null,
                aud: 'authenticated', role: 'authenticated',
                app_metadata: {}, user_metadata: { name: parsed.name || 'Guest' },
                created_at: parsed.created_at || new Date().toISOString(),
              } as User;
              commitAuthUser(fakeUser);
            } else {
              const newUserId = generateUUID();
              const newUser = { id: newUserId, email: null, created_at: new Date().toISOString() };
              // Do not overwrite a corrupt saved identity merely to recover startup.
              if (savedUser === null) localStorage.setItem('sabeel_offline_user', JSON.stringify(newUser));
              const fakeUser = {
                id: newUserId, email: null, aud: 'authenticated', role: 'authenticated',
                app_metadata: {}, user_metadata: { name: 'Guest' },
                created_at: new Date().toISOString(),
              } as User;
              commitAuthUser(fakeUser);
            }
          }
        } catch {
          const fakeUser = {
            id: generateUUID(), email: null, aud: 'authenticated', role: 'authenticated',
            app_metadata: {}, user_metadata: { name: 'Guest' },
            created_at: new Date().toISOString(),
          } as User;
          commitAuthUser(fakeUser);
        }
        if (active) setLoading(false);
      });
      return () => { active = false; };
    }

    let active = true;
    let subscription: { unsubscribe: () => void } | null = null;

    import('@/lib/supabase').then(({ supabase }) => {
      if (!active) return;

      // Intercept password recovery: keep hash tokens and redirect
      if (typeof window !== 'undefined') {
        const hash = window.location.hash;
        if (hash.includes('type=recovery') || hash.includes('type=reset_password')) {
          window.location.href = '/auth/update-password' + hash;
          return;
        }
      }

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!active) return;
        commitAuthUser(session?.user ?? null);
        setLoading(false);
      });

      const { data } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!active) return;
          commitAuthUser(session?.user ?? null);
          setLoading(false);
        }
      );
      subscription = data.subscription;
    }).catch(() => {
      if (!active) return;
      commitAuthUser(null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [commitAuthUser]);

  const getSiteUrl = (): string => {
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
    if (typeof window !== 'undefined') return window.location.origin;
    return 'http://localhost:3000';
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) throw new Error('التطبيق يعمل في الوضع الأوفلاين.');
    const { supabase } = await import('@/lib/supabase');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateError(error.message));
  };

  const signUp = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) throw new Error('التطبيق يعمل في الوضع الأوفلاين.');
    const lastKey = 'sabeel_last_signup';
    try {
      const last = localStorage.getItem(lastKey);
      if (last) {
        const elapsed = Date.now() - parseInt(last, 10);
        if (elapsed < 60 * 1000) {
          throw new Error(`انتظر ${Math.ceil((60 * 1000 - elapsed) / 1000)} ثانية`);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('انتظر')) throw e;
    }
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${getSiteUrl()}/auth/callback` },
    });
    if (error) throw new Error(translateError(error.message));
    if (data?.user && !data.session) {
      throw new Error('تم إنشاء الحساب! تأكد إن الإيميل مُفعّل ثم سجل دخول.');
    }
    try { localStorage.setItem(lastKey, Date.now().toString()); } catch {}
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured()) throw new Error('التطبيق يعمل في الوضع الأوفلاين.');
    const lastKey = 'sabeel_last_reset_password';
    try {
      const last = localStorage.getItem(lastKey);
      if (last) {
        const elapsed = Date.now() - parseInt(last, 10);
        if (elapsed < 60 * 1000) {
          throw new Error(`انتظر ${Math.ceil((60 * 1000 - elapsed) / 1000)} ثانية`);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('انتظر')) throw e;
    }
    const { supabase } = await import('@/lib/supabase');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/auth/callback`,
    });
    if (error) throw new Error(translateError(error.message));
    try { localStorage.setItem(lastKey, Date.now().toString()); } catch {}
  };

  const signInAsGuest = async () => {
    if (!isSupabaseConfigured()) {
      try {
        const newUserId = generateUUID();
        const newUser = { id: newUserId, email: null, created_at: new Date().toISOString() };
        localStorage.setItem('sabeel_offline_user', JSON.stringify(newUser));
        commitAuthUser({ id: newUserId, email: null, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { name: 'Guest' }, created_at: new Date().toISOString() } as User);
      } catch {
        throw new Error('تعذر حفظ بيانات الدخول المحلي.');
      }
      return;
    }
    const { supabase } = await import('@/lib/supabase');
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (!error) return;
      throw new Error(translateError(error.message));
    } catch (e) {
      if (e instanceof Error && (e.message.includes('تم تجاوز') || e.message.includes('انتظر'))) throw e;
    }
    throw new Error('فشل في الدخول كضيف.');
  };

  const signOut = async () => {
    if (!isSupabaseConfigured()) {
      if (!isLocalDemoRequested()) {
        try { localStorage.removeItem('sabeel_offline_user'); } catch {}
      }
      commitAuthUser(null);
      return;
    }
    const { supabase } = await import('@/lib/supabase');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return { user, loading, signIn, signUp, signInAsGuest, signOut, resetPassword };
}
