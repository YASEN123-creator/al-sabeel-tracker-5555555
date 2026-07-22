'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Check } from 'lucide-react';
import { useAppStore } from '@/lib/store';

function UpdatePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const language = useAppStore(s => s.language || 'ar');
  const dir = language === 'en' ? 'ltr' : 'rtl';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Wait for Supabase client to be loaded and exchange the recovery code if present
    (async () => {
      const code = searchParams.get('code');
      try {
        const { supabase } = await import('@/lib/supabase');

        // First, check if we already have a session (e.g., from hash detection)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setInitializing(false);
          return;
        }

        // Otherwise, exchange the code from URL params
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setError(
              language === 'ar'
                ? 'انتهت صلاحية رابط إعادة التعيين. اطلب رابط جديد.'
                : 'The reset link has expired. Request a new one.'
            );
          }
        } else {
          setError(
            language === 'ar'
              ? 'رابط غير صالح. اطلب رابط إعادة تعيين جديد من صفحة الدخول.'
              : 'Invalid link. Request a new reset link from the login page.'
          );
        }
      } catch (e) {
        setError(
          language === 'ar'
            ? 'حدث خطأ أثناء تحميل الصفحة. حاول مرة أخرى.'
            : 'An error occurred while loading the page. Try again.'
        );
      } finally {
        setInitializing(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError(
        language === 'ar'
          ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
          : 'Password must be at least 6 characters'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        language === 'ar'
          ? 'كلمتا المرور غير متطابقتين'
          : 'Passwords do not match'
      );
      return;
    }

    setSubmitting(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        const msg = updateError.message || '';
        if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many')) {
          setError(
            language === 'ar'
              ? 'تم تجاوز عدد المحاولات. استنى دقيقة وحاول مرة أخرى.'
              : 'Too many attempts. Wait a minute and try again.'
          );
        } else {
          setError(msg);
        }
        return;
      }

      setSuccess(true);
      // Sign out so the user logs in fresh with their new password
      await supabase.auth.signOut();

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'حدث خطأ غير متوقع';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center" dir={dir}>
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-800 dark:bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-2xl font-bold text-white">س</span>
          </div>
          <p className="text-gray-400 text-sm">
            {language === 'en' ? 'Loading...' : 'جاري التحميل...'}
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4" dir={dir}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm text-center">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
              {language === 'ar' ? 'تم تحديث كلمة المرور' : 'Password Updated'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {language === 'ar'
                ? 'تم تغيير كلمة المرور بنجاح. سيتم تحويلك لتسجيل الدخول...'
                : 'Your password has been changed. Redirecting to login...'}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4"
      dir={dir}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-800 dark:bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-white">س</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {language === 'ar' ? 'تعيين كلمة مرور جديدة' : 'Set New Password'}
          </h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {language === 'ar'
              ? 'اكتب كلمة المرور الجديدة لحسابك'
              : 'Enter a new password for your account'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500 bg-red-50 dark:bg-red-950 p-2.5 rounded-lg mb-4 whitespace-pre-wrap"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                {language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
              </label>
              <div className="relative">
                <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pr-10 pl-10 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none text-slate-800 dark:text-slate-100"
                  placeholder="•••••••••"
                  required
                  minLength={6}
                  dir="ltr"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                {language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
              </label>
              <div className="relative">
                <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none text-slate-800 dark:text-slate-100"
                  placeholder="•••••••••"
                  required
                  minLength={6}
                  dir="ltr"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || newPassword.length < 6 || newPassword !== confirmPassword}
              className="w-full py-2.5 bg-slate-800 dark:bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-slate-700 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                : (language === 'ar' ? 'تحديث كلمة المرور' : 'Update Password')}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              {language === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
          <div className="text-gray-400 text-sm">جاري التحميل...</div>
        </div>
      }
    >
      <UpdatePasswordContent />
    </Suspense>
  );
}
