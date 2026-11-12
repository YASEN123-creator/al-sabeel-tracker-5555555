'use client';

import { useEffect, useState, useCallback, useRef, useSyncExternalStore } from 'react';
import { ArrowUp } from 'lucide-react';
import { useShallow } from '@/lib/useAppShallow';
import { useAuth } from '@/lib/useAuth';
import { useAppStore, withoutTrashedProjects } from '@/lib/store';
import { useTimer } from '@/lib/useTimer';
import { toLocalDateKey } from '@/lib/localDate';
import { seedLocalDemoIfRequested } from '@/lib/demoData';
import { isLocalDemoRequested, LOCAL_DEMO_MARKER, LOCAL_DEMO_USER_ID } from '@/lib/demoMode';
import {
  fetchProjects, fetchTasks, fetchSessions,
  fetchGoals, fetchSettings, upsertSettings,
  updateTask as updateTaskApi,
  fetchPrayerLogs
} from '@/lib/api';
import AuthForm from '@/components/AuthForm';
import Toast from '@/components/Toast';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import Projects from '@/components/Projects';
import Tasks from '@/components/Tasks';
import Sessions from '@/components/Sessions';
import Analytics from '@/components/Analytics';
import GraphAnalytics from '@/components/GraphAnalytics';
import Goals from '@/components/Goals';
import Settings from '@/components/Settings';
import Library from '@/components/Library';
import Notifications from '@/components/Notifications';
import VideoLibrary from '@/components/VideoLibrary';
import Prayers from '@/components/Prayers';
import GlobalActions from '@/components/GlobalActions';

const subscribeToHydration = () => () => {};

export default function HomePage() {
  const { user, loading: authLoading, signIn, signUp, signInAsGuest, signOut, resetPassword } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  const {
    activeView, isSidebarOpen, language, darkMode,
    setProjects, setTasks, setSessions, setGoals, setSettings: setStoreSettings,
    switchUser, setPrayerLogs,
  } = useAppStore(useShallow((state) => ({
    activeView: state.activeView,
    isSidebarOpen: state.isSidebarOpen,
    language: state.language,
    darkMode: state.darkMode,
    setProjects: state.setProjects,
    setTasks: state.setTasks,
    setSessions: state.setSessions,
    setGoals: state.setGoals,
    setSettings: state.setSettings,
    switchUser: state.switchUser,
    setPrayerLogs: state.setPrayerLogs,
  })));

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeView]);

  useEffect(() => {
    const update = () => setShowBackToTop(window.scrollY > 600);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  // Timer persists across views (called here in page.tsx)
  useTimer();

  // Track last loaded user to prevent duplicate loading
  const lastLoadedUserRef = useRef('');
  const activeUserRef = useRef<string | null>(null);

  // Load all data when user changes
  const loadAllData = useCallback(async (userId: string) => {
    if (lastLoadedUserRef.current === userId) return;
    lastLoadedUserRef.current = userId;

    try {
      await seedLocalDemoIfRequested(userId);
      let settingsData: Awaited<ReturnType<typeof fetchSettings>> = null;
      try {
        settingsData = await fetchSettings(userId);
      } catch {
        settingsData = null;
      }

      const [projectsData, tasksData, sessionsData, goalsData, prayersData] = await Promise.all([
        fetchProjects(userId),
        fetchTasks(userId),
        fetchSessions(userId),
        fetchGoals(userId),
        fetchPrayerLogs(userId),
      ]);

      if (useAppStore.getState().userId !== userId) return;

      const currentTrash = useAppStore.getState().deletedProjects;
      setProjects(withoutTrashedProjects(projectsData, currentTrash));
      setTasks(tasksData);
      setSessions(sessionsData);
      setGoals(goalsData);
      setPrayerLogs(prayersData);

      if (settingsData) {
        setStoreSettings(settingsData);
      } else {
        try {
          const defaultSettings = await upsertSettings(userId, {
            enable_pomodoro: true,
            enable_goals: true,
            enable_analytics: true,
            pomodoro_work_duration: 25,
            pomodoro_break_duration: 5,
            adhan_enabled: true,
          });
          if (useAppStore.getState().userId !== userId) return;
          setStoreSettings(defaultSettings);
        } catch {
          // Table doesn't exist
        }
      }
    } catch (_loadErr) {
      const msg = _loadErr instanceof Error ? _loadErr.message : '';
      if (msg.includes('rate limit') || msg.includes('الحد المسموح')) {
        console.warn('Rate limited during data load. Will retry on next interaction.');
        lastLoadedUserRef.current = '';
      } else {
        console.error('Error loading data:', _loadErr);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setProjects, setTasks, setSessions, setGoals, setStoreSettings]);

  // Reset recurring tasks based on their selected days
  useEffect(() => {
    const resetRecurringTasks = async () => {
      const store = useAppStore.getState();
      if (!store.userId) return;

      const todayStr = toLocalDateKey();
      const lastResetKey = `sabeel_recurring_reset_${store.userId}`;
      const todayDay = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

      // Check if already reset today
      try {
        const lastReset = localStorage.getItem(lastResetKey);
        if (lastReset === todayStr) return;
      } catch { /* ignore */ }

      const tasksToReset = store.tasks.filter(
        (t) => {
          if (!t.is_recurring || !t.is_completed || !t.updated_at) return false;
          if (toLocalDateKey(new Date(t.updated_at)) === todayStr) return false;
          if (!t.recurring_days || t.recurring_days.length === 0) return true;
          return t.recurring_days.includes(todayDay);
        }
      );

      if (tasksToReset.length === 0) {
        localStorage.setItem(lastResetKey, todayStr);
        return;
      }

      let renewedCount = 0;
      let failedCount = 0;
      for (const task of tasksToReset) {
        try {
          const updated = await updateTaskApi(task.id, store.userId || '', { is_completed: false });
          store.updateTask(updated);
          renewedCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      // Keep retrying failed task updates later today rather than marking the
      // entire recurring reset complete after only a partial persistence.
      if (failedCount === 0) {
        try {
          localStorage.setItem(lastResetKey, todayStr);
        } catch { /* ignore */ }
      }

      if (renewedCount > 0) {
        store.addToast(
          store.language === 'ar' ? `تم تجديد ${renewedCount} مهمة متكررة` : `Renewed ${renewedCount} recurring tasks`,
          'info'
        );
      }
      if (failedCount > 0) {
        store.addToast(
          store.language === 'ar'
            ? `تعذر تجديد ${failedCount} مهمة متكررة. ستتم المحاولة مرة أخرى.`
            : `Could not renew ${failedCount} recurring tasks. They will be retried.`,
          'error'
        );
      }
    };

    const timer = setTimeout(resetRecurringTasks, 3000);
    return () => clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    const nextUserEmail = user?.email ?? null;

    if (activeUserRef.current !== nextUserId) {
      // One store update clears the previous account before any new requests
      // can populate state. Scoped local-only data is loaded for the next user.
      switchUser(nextUserId, nextUserEmail);
      activeUserRef.current = nextUserId;
      lastLoadedUserRef.current = '';
    } else if (useAppStore.getState().userEmail !== nextUserEmail) {
      useAppStore.getState().setUserEmail(nextUserEmail);
    }

    if (nextUserId) {
      loadAllData(nextUserId).finally(() => {
        if (useAppStore.getState().userId === nextUserId) {
          useAppStore.getState().setDataLoading(false);
        }
      });
    }
  }, [user, loadAllData, switchUser]);

  // Auth handlers
  const [loginCooldown, setLoginCooldown] = useState(0);

  const handleAuthSubmit = async (email: string, password: string) => {
    if (loginCooldown > 0) {
      const lang = useAppStore.getState().language || 'ar';
      setAuthError(lang === 'ar'
        ? `انتظر ${loginCooldown} ثانية قبل المحاولة مرة أخرى`
        : `Wait ${loginCooldown} seconds before trying again`);
      return;
    }

    setAuthError('');
    setAuthSubmitting(true);
    try {
      if (authMode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        // After successful signup, switch to login mode
        const lang = useAppStore.getState().language || 'ar';
        setAuthError(lang === 'ar'
          ? 'تم إنشاء الحساب بنجاح! سجل دخول الآن.'
          : 'Account created! Sign in now.');
        setAuthMode('login');
        return;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      const isRateLimit = (
        message.includes('rate limit') ||
        message.includes('Too many requests') ||
        message.includes('429') ||
        message.includes('over_request_rate_limit')
      );

      if (isRateLimit) {
        setLoginCooldown(60);
        const interval = setInterval(() => {
          setLoginCooldown(prev => {
            if (prev <= 1) { clearInterval(interval); return 0; }
            return prev - 1;
          });
        }, 1000);
        setAuthError('تم تجاوز عدد المحاولات. استخدم "دخول سريع" بالأعلى أو انتظر قليلاً وحاول مرة أخرى.');
      } else if (message.includes('Invalid login') || message.includes('Invalid credentials')) {
        setAuthError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else if (message.includes('User already registered')) {
        setAuthError('هذا البريد الإلكتروني مسجل بالفعل');
      } else if (message.includes('Password should be at least')) {
        setAuthError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      } else {
        setAuthError(message.length > 100 ? 'حدث خطأ. تأكد من البيانات وحاول مرة أخرى.' : message);
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const isRateLimited = loginCooldown > 0;

  const handleGuestLogin = async () => {
    setAuthError('');
    setGuestLoading(true);
    try {
      await signInAsGuest();
    } catch {
      const lang = useAppStore.getState().language || 'ar';
      setAuthError(lang === 'ar'
        ? 'فشل في الدخول السريع. تأكد من اتصال الإنترنت وحاول مرة أخرى.'
        : 'Quick login failed. Check your internet and try again.');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleSignOut = async () => {
    const signingOutUser = user;
    try {
      switchUser(null, null);
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
      if (signingOutUser) {
        switchUser(signingOutUser.id, signingOutUser.email ?? null);
        activeUserRef.current = signingOutUser.id;
        lastLoadedUserRef.current = '';
        await loadAllData(signingOutUser.id);
        useAppStore.getState().addToast(
          language === 'ar' ? 'تعذر تسجيل الخروج. حاول مرة أخرى.' : 'Could not sign out. Please try again.',
          'error',
        );
      }
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="w-16 h-16 bg-slate-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir={language === 'en' ? 'ltr' : 'rtl'}>
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-2xl font-bold text-white">س</span>
          </div>
          <p className="text-gray-400 text-sm">{language === 'en' ? 'Loading...' : 'جاري التحميل...'}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthForm
        mode={authMode}
        onSubmit={handleAuthSubmit}
        onSwitch={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}
        onGuestLogin={handleGuestLogin}
        onResetPassword={resetPassword}
        error={authError}
        loading={authSubmitting}
        guestLoading={guestLoading}
        loginCooldown={loginCooldown}
        isRateLimited={isRateLimited}
      />
    );
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard />;
      case 'projects': return <Projects />;
      case 'tasks': return <Tasks />;
      case 'sessions': return <Sessions />;
      case 'analytics': return <Analytics />;
      case 'charts': return <GraphAnalytics />;
      case 'goals': return <Goals />;
      case 'settings': return <Settings />;
      case 'library': return <Library />;
      case 'notifications': return <Notifications />;
      case 'video': return <VideoLibrary />;
      case 'prayers': return <Prayers />;
      default: return <Dashboard />;
    }
  };

  const dir = language === 'en' ? 'ltr' : 'rtl';
  let showDemoBadge = false;
  if (hydrated && isLocalDemoRequested() && user.id === LOCAL_DEMO_USER_ID) {
    try {
      showDemoBadge = Boolean(localStorage.getItem(`${LOCAL_DEMO_MARKER}:${user.id}`));
    } catch {
      // Browser storage may be unavailable.
    }
  }

  return (
    <div className="min-h-screen" dir={dir} data-active-view={activeView}>
      <Toast />
      <Sidebar onSignOut={handleSignOut} />
      <GlobalActions />
      {activeView !== 'dashboard' && showBackToTop && <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })} aria-label={language === 'ar' ? 'الرجوع لأعلى الصفحة' : 'Back to top'} title={language === 'ar' ? 'الرجوع لأعلى الصفحة' : 'Back to top'} className={`fixed bottom-24 z-30 hidden h-11 w-11 place-items-center rounded-xl border border-violet-200 bg-white/95 text-violet-700 shadow-[0_6px_20px_rgba(60,45,85,.1)] transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-violet-200 md:grid ${language === 'ar' ? 'left-5' : 'right-5'}`}><ArrowUp size={18} /></button>}
      <main className={`${activeView === 'dashboard' ? 'min-h-screen overflow-auto bg-[#f8f9fa] p-4 transition-all duration-300 dark:bg-[#080d17] md:p-8' : 'sabeel-content min-h-screen overflow-auto p-4 pb-28 pt-16 transition-all duration-300 md:p-7 md:pb-28 xl:p-9'} ${isSidebarOpen ? (language === 'en' ? 'md:ml-64' : 'md:mr-64') : ''}`}>
        <div className={`mx-auto w-full ${activeView === 'dashboard' ? 'max-w-[1680px]' : 'max-w-[1360px]'}`}>
          {showDemoBadge && activeView !== 'dashboard' && <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-center text-xs font-semibold text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200">{language === 'ar' ? 'معاينة محلية ببيانات تجريبية' : 'Local preview with sample data'}</div>}
          {activeView === 'dashboard' ? renderView() : <div key={activeView} className="sabeel-page-enter">{renderView()}</div>}
        </div>
      </main>
    </div>
  );
}
