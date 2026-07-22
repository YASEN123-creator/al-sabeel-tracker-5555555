'use client';

import { motion } from 'framer-motion';
import { useState, useRef } from 'react';
import { Save, Bell, Timer, User, Clock, FolderKanban, CheckCircle2, Volume2, VolumeX, Upload, X, Link2, AlertTriangle, Download, HardDrive, FileJson, ShieldCheck, Music, Scissors } from 'lucide-react';
import AudioTrimmer from './AudioTrimmer';
import { useAppStore, withoutTrashedProjects } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { fetchBackupCloudData, restoreCloudData, upsertSettings } from '@/lib/api';
import { playAlarmSound } from '@/lib/useTimer';
import { createBackup, downloadBackup, getBackupSummary, readBackupFile, saveSafetyBackup } from '@/lib/backup';
import type { UserSettings } from '@/lib/types';
import type { SabeelBackup, ImportMode } from '@/lib/backup';
import { useShallow } from '@/lib/useAppShallow';
import { isSupabaseConfigured } from '@/lib/supabaseConfig';

// Only bell (default) + custom sound upload

export default function Settings() {
  const { settings, setSettings, language, addToast, userEmail, sessions, tasks, projects } = useAppStore(useShallow((state) => ({
    settings: state.settings,
    setSettings: state.setSettings,
    language: state.language,
    addToast: state.addToast,
    userEmail: state.userEmail,
    sessions: state.sessions,
    tasks: state.tasks,
    projects: state.projects,
  })));
  const t = useT();
  const lang = language || 'ar';
  const isRTL = lang !== 'en';
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [enablePomodoro, setEnablePomodoro] = useState(settings?.enable_pomodoro ?? true);
  const [enableGoals, setEnableGoals] = useState(settings?.enable_goals ?? true);
  const [enableAnalytics, setEnableAnalytics] = useState(settings?.enable_analytics ?? true);
  const [adhanEnabled, setAdhanEnabled] = useState(settings?.adhan_enabled ?? true);
  const [workDuration, setWorkDuration] = useState(settings?.pomodoro_work_duration ?? 25);
  const [breakDuration, setBreakDuration] = useState(settings?.pomodoro_break_duration ?? 5);
  const [alarmSound, setAlarmSound] = useState(settings?.alarm_sound || 'bell');
  const [customAlarmData, setCustomAlarmData] = useState(settings?.custom_alarm_data || '');
  const [previewing, setPreviewing] = useState(false);
  const [trimmerSrc, setTrimmerSrc] = useState<string | null>(null);

  // ── Guest Linking State ──
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkConfirmPassword, setLinkConfirmPassword] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);

  const isGuest = !userEmail;

  // ── Backup / Import State ──
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<ImportMode>('replace');
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [previewBackup, setPreviewBackup] = useState<SabeelBackup | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  // Computed stats
  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const totalProjects = projects.filter(p => !p.is_folder).length;
  const completedTasks = tasks.filter(t => t.is_completed).length;

  const handleSave = async () => {
    try {
      const userIdVal = useAppStore.getState().userId || '';
      const updated = await upsertSettings(userIdVal, {
        enable_pomodoro: enablePomodoro,
        enable_goals: enableGoals,
        enable_analytics: enableAnalytics,
        pomodoro_work_duration: workDuration,
        pomodoro_break_duration: breakDuration,
        adhan_enabled: adhanEnabled,
        alarm_sound: alarmSound,
        custom_alarm_data: customAlarmData,
      } as Partial<UserSettings>);
      setSettings(updated);
      setSaved(true);
      addToast(t('toast.saved'), 'success');
      setTimeout(() => setSaved(false), 2000);
    } catch { addToast(t('toast.error'), 'error'); }
  };

  const handlePreview = async () => {
    if (previewing) return;
    setPreviewing(true);
    try {
      await playAlarmSound(alarmSound, customAlarmData);
    } catch { /* silent */ }
    setTimeout(() => setPreviewing(false), 3000);
  };

  const handleUploadSound = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast(lang === 'ar' ? 'حجم الملف كبير جداً. الحد الأقصى 5 ميجا' : 'File too large. Max 5MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setTrimmerSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTrimConfirm = (trimmedDataUrl: string) => {
    setCustomAlarmData(trimmedDataUrl);
    setAlarmSound('custom');
    setTrimmerSrc(null);
    addToast(lang === 'ar' ? 'تم قص وحفظ الصوت بنجاح' : 'Sound trimmed and saved', 'success');
  };

  const handleTrimCancel = () => {
    setTrimmerSrc(null);
  };

  const handleRemoveCustom = () => {
    setCustomAlarmData('');
    setAlarmSound('bell');
  };

  // ── Backup Import ──
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      addToast(t('backup.invalidFile'), 'error');
      if (backupInputRef.current) backupInputRef.current.value = '';
      return;
    }

    addToast(t('backup.readingFile'), 'info');

    try {
      const backup = await readBackupFile(file);
      setPreviewBackup(backup);
      setShowImportPreview(true);
      setImportResult(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('backup.invalidFile'), 'error');
    }

    if (backupInputRef.current) backupInputRef.current.value = '';
  };

  const createCurrentBackup = async () => {
    const initialStore = useAppStore.getState();
    if (!initialStore.userId) throw new Error(lang === 'ar' ? 'لا يوجد مستخدم نشط' : 'No active user');
    const backupUserId = initialStore.userId;
    const cloud = await fetchBackupCloudData(backupUserId);
    const store = useAppStore.getState();
    if (store.userId !== backupUserId) throw new Error(lang === 'ar' ? 'تغير الحساب أثناء تجهيز النسخة' : 'Account changed while preparing the backup');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const source = isSupabaseConfigured(supabaseUrl, supabaseKey)
      ? 'cloud' as const
      : 'offline' as const;
    return createBackup({
      source,
      data: {
        ...cloud,
        deletedProjects: store.deletedProjects,
        projectRatings: store.projectRatings,
        projectPlans: store.projectPlans,
        sessionPlans: store.sessionPlans,
        libraryResources: store.libraryResources,
        videoItems: store.videoItems,
        notifications: store.notifications,
      },
      preferences: { language: store.language, darkMode: store.darkMode },
    });
  };

  const handleExport = async () => {
    if (exportLoading) return;
    setExportLoading(true);
    try {
      downloadBackup(await createCurrentBackup());
      addToast(t('backup.exportSuccess'), 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : t('backup.importError'), 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const handleImport = async () => {
    if (!previewBackup) return;

    setImportLoading(true);
    setImportResult(null);

    try {
      const store = useAppStore.getState();
      if (!store.userId) throw new Error(lang === 'ar' ? 'لا يوجد مستخدم نشط' : 'No active user');
      const restoreUserId = store.userId;

      // A valid current-state snapshot is mandatory before any restore writes.
      saveSafetyBackup(restoreUserId, await createCurrentBackup());
      if (useAppStore.getState().userId !== restoreUserId) throw new Error(lang === 'ar' ? 'تغير الحساب أثناء الاستعادة' : 'Account changed during restore');

      const cloudResult = await restoreCloudData(restoreUserId, previewBackup.data, importMode);
      if (useAppStore.getState().userId !== restoreUserId) throw new Error(lang === 'ar' ? 'تغير الحساب أثناء الاستعادة' : 'Account changed during restore');
      const browserFailures = useAppStore.getState().restoreBrowserData({
        deletedProjects: previewBackup.data.deletedProjects,
        projectRatings: previewBackup.data.projectRatings,
        projectPlans: previewBackup.data.projectPlans,
        sessionPlans: previewBackup.data.sessionPlans,
        libraryResources: previewBackup.data.libraryResources,
        videoItems: previewBackup.data.videoItems,
        notifications: previewBackup.data.notifications,
      }, importMode);

      const current = useAppStore.getState();
      current.setProjects(withoutTrashedProjects(cloudResult.data.projects, current.deletedProjects));
      current.setTasks(cloudResult.data.tasks);
      current.setSessions(cloudResult.data.sessions);
      current.setGoals(cloudResult.data.goals);
      current.setPrayerLogs(cloudResult.data.prayerLogs);
      if (cloudResult.data.settings) current.setSettings(cloudResult.data.settings);

      const failedCloud = cloudResult.domains.filter((domain) => !domain.success).map((domain) => domain.domain);
      const success = failedCloud.length === 0 && browserFailures.length === 0;
      const failed = [...failedCloud, ...browserFailures];
      if (success) {
        const latestStore = useAppStore.getState();
        latestStore.setLanguage(previewBackup.preferences.language);
        if (latestStore.darkMode !== previewBackup.preferences.darkMode) latestStore.toggleDarkMode();
      }
      const message = success
        ? t('backup.importSuccess')
        : `${t('backup.importPartial')}: ${failed.join(', ')}`;
      setImportResult({ success, message });
      addToast(message, success ? 'success' : 'error');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('backup.importError');
      setImportResult({ success: false, message });
      addToast(message, 'error');
    } finally {
      setImportLoading(false);
    }
  };

  // ── Guest Linking ──
  const handleLinkAccount = async () => {
    if (!linkEmail.trim() || !linkPassword || linkPassword.length < 6) {
      addToast(lang === 'ar' ? 'أدخل إيميل وباسورد صحيح (6 أحرف على الأقل)' : 'Enter valid email and password (min 6 chars)', 'error');
      return;
    }
    if (linkPassword !== linkConfirmPassword) {
      addToast(lang === 'ar' ? 'كلمة المرور غير متطابقة' : 'Passwords do not match', 'error');
      return;
    }

    setLinkLoading(true);
    const linkingUserId = useAppStore.getState().userId;
    try {
      // Check if Supabase is configured
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      const isConfigured = isSupabaseConfigured(supabaseUrl, supabaseKey);

      if (!isConfigured) {
        throw new Error(t('link.cloudRequired'));
      }

      // Upgrade the existing anonymous identity. The user ID does not change,
      // so no records are copied and retrying cannot duplicate user data.
      const { supabase } = await import('@/lib/supabase');
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { data: currentAuth, error: currentUserError } = await supabase.auth.getUser();
      if (currentUserError) throw currentUserError;
      if (!linkingUserId || currentAuth.user?.id !== linkingUserId || useAppStore.getState().userId !== linkingUserId) {
        throw new Error(lang === 'ar' ? 'تغير الحساب أثناء الربط' : 'Account changed during linking');
      }
      if (!currentAuth.user?.is_anonymous) throw new Error(t('link.alreadyLinked'));

      const { data, error } = await supabase.auth.updateUser(
        { email: linkEmail.trim(), password: linkPassword },
        { emailRedirectTo: `${origin}/auth/callback` },
      );
      if (error) throw error;
      if (useAppStore.getState().userId !== linkingUserId) return;
      if (data.user?.email) useAppStore.getState().setUserEmail(data.user.email);
      setLinkSuccess(true);
      addToast(t('link.upgradeRequested'), 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('Invalid credentials') || message.includes('Invalid login')) {
        addToast(lang === 'ar' ? 'الإيميل أو الباسورد غير صحيح' : 'Invalid email or password', 'error');
      } else if (message === t('link.cloudRequired') || message === t('link.alreadyLinked')) {
        addToast(message, 'error');
      } else {
        addToast(t('link.error'), 'error');
      }
    } finally {
      setLinkLoading(false);
    }
  };

  const toggleKnob = (enabled: boolean) => ({
    className: `absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${enabled ? (isRTL ? 'right-0.5' : 'left-0.5') : (isRTL ? 'right-[22px]' : 'left-[22px]')}`,
  });

  return (
    <div className="sabeel-page-enter w-full">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="ps-14 md:ps-0">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{t('settings.title')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('settings.subtitle')}</p>
        </div>
        <button onClick={handleSave} className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl bg-slate-900 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 focus-visible:ring-4 focus-visible:ring-violet-500/20 dark:bg-violet-600 dark:hover:bg-violet-500 sm:self-auto"><Save size={16} />{t('settings.save')}</button>
      </div>

      <div className="w-full space-y-4">
        {/* Profile Section */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#26334a] dark:bg-[#111a2a]">
          <div className="h-1 bg-violet-600" />
          <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
              <User size={20} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t('profile.title')}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.profileDesc')}</p>
            </div>
            {isGuest ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 font-medium">{t('link.guestBadge')}</span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-950/50 text-green-600 dark:text-green-400 font-medium">{t('link.linkedBadge')}</span>
            )}
          </div>
          {/* Avatar + Email */}
          <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-slate-50 p-5 dark:bg-[#0d1422] sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-black text-white shadow-lg dark:bg-violet-600">
              {userEmail ? userEmail.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black text-slate-900 dark:text-white">{userEmail || (lang === 'ar' ? 'حساب ضيف' : 'Guest Account')}</p>
              <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{lang === 'ar' ? '● حساب نشط' : '● Active account'}</p>
            </div>
          </div>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Timer size={14} className="text-blue-500" />
                <span className="text-xs text-gray-400 dark:text-gray-500">{t('profile.totalSessions')}</span>
              </div>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{totalSessions}</p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className="text-emerald-500" />
                <span className="text-xs text-gray-400 dark:text-gray-500">{t('profile.totalHours')}</span>
              </div>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{totalHours} <span className="text-xs font-normal text-gray-400 dark:text-gray-500">{t('common.hours')}</span></p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <FolderKanban size={14} className="text-orange-500" />
                <span className="text-xs text-gray-400 dark:text-gray-500">{t('profile.totalProjects')}</span>
              </div>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{totalProjects}</p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={14} className="text-violet-500" />
                <span className="text-xs text-gray-400 dark:text-gray-500">{t('profile.totalTasks')}</span>
              </div>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{completedTasks}</p>
            </div>
          </div>

          {/* Link Account Button (for guests) */}
          {isGuest && !linkSuccess && (
            <div className="mt-5">
              {!showLinkForm ? (
                <button
                  onClick={() => setShowLinkForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-l from-blue-600 to-blue-700 text-white text-sm font-medium hover:from-blue-700 hover:to-blue-800 transition-colors"
                >
                  <Link2 size={16} />
                  {t('link.title')}
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 size={16} className="text-blue-600" />
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{t('link.title')}</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {t('link.warning')}
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{t('link.email')}</label>
                    <input type="email" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:border-blue-400 text-slate-800 dark:text-slate-100" placeholder={t('link.emailPlaceholder')} dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{t('link.password')}</label>
                    <input type="password" value={linkPassword} onChange={(e) => setLinkPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:border-blue-400 text-slate-800 dark:text-slate-100" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{t('link.confirmPassword')}</label>
                    <input type="password" value={linkConfirmPassword} onChange={(e) => setLinkConfirmPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:border-blue-400 text-slate-800 dark:text-slate-100" dir="ltr" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleLinkAccount} disabled={linkLoading} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {linkLoading ? (lang === 'ar' ? 'جاري الربط...' : 'Linking...') : t('link.button')}
                    </button>
                    <button onClick={() => setShowLinkForm(false)} className="px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm">
                      <X size={14} />
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          )}
          </div>

          {linkSuccess && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 rounded-xl flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-600" />
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">{t('link.upgradeRequested')}</p>
            </div>
          )}
        </div>

        {/* Alarm Sound Settings */}
        <div className="grid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#26334a] dark:bg-[#111a2a] lg:grid-cols-[minmax(220px,0.32fr)_1fr] lg:gap-8">
          <div className="mb-5 flex items-center gap-3 lg:mb-0 lg:items-start">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950 flex items-center justify-center">
              {adhanEnabled ? <Volume2 size={20} className="text-orange-600" /> : <VolumeX size={20} className="text-gray-400" />}
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t('alarm.title')}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('alarm.subtitle')}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Sound Toggle */}
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('prayers.adhanSetting')}</p><p className="text-xs text-gray-400 dark:text-gray-500">{t('prayers.adhanSettingDesc')}</p></div>
              <button onClick={() => setAdhanEnabled(!adhanEnabled)} className={`relative w-11 h-6 rounded-full transition-colors ${adhanEnabled ? 'bg-slate-800 dark:bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}><span {...toggleKnob(adhanEnabled)} /></button>
            </div>

            {adhanEnabled && (
              <>
                {/* Current Sound Display */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">{t('alarm.currentSound')}</label>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${alarmSound === 'custom' ? 'bg-purple-100 dark:bg-purple-950/50' : 'bg-orange-100 dark:bg-orange-950/50'}`}>
                      {alarmSound === 'custom' ? <Music size={18} className="text-purple-600 dark:text-purple-400" /> : <Bell size={18} className="text-orange-600 dark:text-orange-400" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {alarmSound === 'custom' ? (lang === 'ar' ? 'صوت مخصص' : 'Custom Sound') : t('alarm.bell')}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {alarmSound === 'custom' ? (lang === 'ar' ? 'الصوت اللي رفعته' : 'Your uploaded sound') : (lang === 'ar' ? 'صوت الجرس الافتراضي' : 'Default bell sound')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Custom Sound Upload */}
                <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('alarm.custom')}</p>
                    {customAlarmData && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAlarmSound(customAlarmData ? 'custom' : 'bell')}
                          className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                            alarmSound === 'custom'
                              ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300'
                              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                        >
                          {lang === 'ar' ? 'استخدم' : 'Use'}
                        </button>
                        <button onClick={handleRemoveCustom} className="text-xs text-red-500 hover:text-red-600 font-medium">{t('alarm.removeCustom')}</button>
                      </div>
                    )}
                  </div>
                  {customAlarmData ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                      <Music size={18} className="text-purple-500" />
                      <span className="text-sm text-purple-700 dark:text-purple-300 font-medium flex-1">{lang === 'ar' ? 'صوت مخصص مرفوع' : 'Custom sound uploaded'}</span>
                      <span className="text-xs text-gray-400">MP3/WAV</span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{t('alarm.noCustom')}</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-dashed border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors w-full justify-center"
                      >
                        <Upload size={16} />
                        {t('alarm.upload')}
                      </button>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{t('alarm.uploadHint')}</p>
                      <p className="text-xs text-purple-500 dark:text-purple-400 mt-1 flex items-center gap-1"><Scissors size={11} />{lang === 'ar' ? 'بعد الرفع هتقدر تقطع الصوت و تختار الجزء اللي عايزه' : 'After uploading, you can trim and select the part you want'}</p>
                      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleUploadSound} />
                    </div>
                  )}
                </div>

                {/* Preview Button */}
                <button
                  onClick={handlePreview}
                  disabled={previewing || (alarmSound === 'custom' && !customAlarmData)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Volume2 size={16} className={previewing ? 'animate-pulse' : ''} />
                  {previewing ? '...' : t('alarm.preview')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="grid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#26334a] dark:bg-[#111a2a] lg:grid-cols-[minmax(220px,0.32fr)_1fr] lg:gap-8">
          <div className="mb-5 flex items-center gap-3 lg:mb-0 lg:items-start">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center"><Bell size={20} className="text-blue-600" /></div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t('settings.features')}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.featuresDesc')}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('settings.pomodoro')}</p><p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.pomodoroDesc')}</p></div>
              <button onClick={() => setEnablePomodoro(!enablePomodoro)} className={`relative w-11 h-6 rounded-full transition-colors ${enablePomodoro ? 'bg-slate-800 dark:bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}><span {...toggleKnob(enablePomodoro)} /></button>
            </div>
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('settings.goalsFeature')}</p><p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.goalsDesc')}</p></div>
              <button onClick={() => setEnableGoals(!enableGoals)} className={`relative w-11 h-6 rounded-full transition-colors ${enableGoals ? 'bg-slate-800 dark:bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}><span {...toggleKnob(enableGoals)} /></button>
            </div>
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t('settings.analyticsFeature')}</p><p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.analyticsDesc')}</p></div>
              <button onClick={() => setEnableAnalytics(!enableAnalytics)} className={`relative w-11 h-6 rounded-full transition-colors ${enableAnalytics ? 'bg-slate-800 dark:bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}><span {...toggleKnob(enableAnalytics)} /></button>
            </div>
          </div>
        </div>

        {/* Timer Settings */}
        <div className="grid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#26334a] dark:bg-[#111a2a] lg:grid-cols-[minmax(220px,0.32fr)_1fr] lg:gap-8">
          <div className="mb-5 flex items-center gap-3 lg:mb-0 lg:items-start">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center"><Timer size={20} className="text-purple-600" /></div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t('settings.timer')}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.timerDesc')}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{t('settings.workDuration')}</label>
              <input type="number" value={workDuration} onChange={(e) => setWorkDuration(parseInt(e.target.value) || 25)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none text-slate-800 dark:text-slate-100" min="1" max="120" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{t('settings.breakDuration')}</label>
              <input type="number" value={breakDuration} onChange={(e) => setBreakDuration(parseInt(e.target.value) || 5)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none text-slate-800 dark:text-slate-100" min="1" max="60" />
            </div>
          </div>
        </div>

        {/* Backup & Restore Section */}
        <div className="grid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#26334a] dark:bg-[#111a2a] lg:grid-cols-[minmax(220px,0.32fr)_1fr] lg:gap-8">
          <div className="mb-5 flex items-center gap-3 lg:mb-0 lg:items-start">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
              <HardDrive size={20} className="text-emerald-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t('backup.title')}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('backup.subtitle')}</p>
            </div>
            <ShieldCheck size={16} className="text-emerald-500" />
          </div>

          <div className="space-y-4">
            {/* Export Button */}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{t('backup.export')}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{t('backup.exportDesc')}</p>
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors w-full justify-center"
              >
                <Download size={16} />
                {exportLoading ? (lang === 'ar' ? 'جاري تجهيز النسخة...' : 'Preparing backup...') : t('backup.export')}
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{t('backup.exportHint')}</p>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 dark:border-slate-700" />

            {/* Import Section */}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{t('backup.import')}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{t('backup.importDesc')}</p>

              {!showImportPreview ? (
                <button
                  onClick={() => backupInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors w-full justify-center"
                >
                  <Upload size={16} />
                  {t('backup.import')}
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4"
                >
                  {/* Preview Card */}
                  {previewBackup && (
                    <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <FileJson size={16} className="text-blue-500" />
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('backup.previewTitle')}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
                          <p className="text-gray-400 dark:text-gray-500">{t('backup.exportDate')}</p>
                          <p className="font-medium text-slate-700 dark:text-slate-200 mt-0.5">
                            {new Date(previewBackup.exportedAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
                          <p className="text-gray-400 dark:text-gray-500">{t('backup.version')}</p>
                          <p className="font-medium text-slate-700 dark:text-slate-200 mt-0.5">v{previewBackup.version}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('backup.includes')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {getBackupSummary(previewBackup, lang).filter(item => item.count > 0).map((item) => (
                            <span key={item.label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs">
                              {item.label}: <b>{item.count}</b> {t('backup.items')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Import Mode Selection */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">{t('backup.importMode')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setImportMode('replace')}
                        className={`p-3 rounded-xl text-xs text-start transition-all border ${
                          importMode === 'replace'
                            ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800'
                            : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600'
                        }`}
                      >
                        <p className={`font-semibold ${importMode === 'replace' ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>{t('backup.modeReplace')}</p>
                        <p className="text-gray-400 dark:text-gray-500 mt-0.5">{t('backup.modeReplaceDesc')}</p>
                      </button>
                      <button
                        onClick={() => setImportMode('merge')}
                        className={`p-3 rounded-xl text-xs text-start transition-all border ${
                          importMode === 'merge'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                            : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600'
                        }`}
                      >
                        <p className={`font-semibold ${importMode === 'merge' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>{t('backup.modeMerge')}</p>
                        <p className="text-gray-400 dark:text-gray-500 mt-0.5">{t('backup.modeMergeDesc')}</p>
                      </button>
                    </div>
                  </div>

                  {/* Warning */}
                  <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
                    <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">{t('backup.importWarning')}</p>
                  </div>

                  {/* Import Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleImport}
                      disabled={importLoading}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 dark:bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-slate-700 dark:hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {importLoading ? (
                        <>{t('backup.importing')}</>
                      ) : (
                        <><Upload size={16} />{t('backup.confirmImport')}</>
                      )}
                    </button>
                    <button
                      onClick={() => { setShowImportPreview(false); setPreviewBackup(null); setImportResult(null); }}
                      className="px-3 py-2.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Import Result */}
                  {importResult && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`p-3 rounded-xl flex items-center gap-2 ${importResult.success ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}
                    >
                      <CheckCircle2 size={16} className={importResult.success ? 'text-green-600' : 'text-red-600'} />
                      <div>
                        <p className={`text-sm font-medium ${importResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{importResult.message}</p>
                        {importResult.success && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('backup.importSuccessDesc')}</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('backup.fileHint')}</p>
              <input ref={backupInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#26334a] dark:bg-[#111a2a]">
          <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 dark:bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-slate-700 dark:hover:bg-blue-700 transition-colors"><Save size={16} />{t('settings.save')}</button>
          {saved && <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-emerald-600 font-medium">{t('settings.saved')}</motion.span>}
        </div>
      </div>

      {/* Audio Trimmer Modal */}
      {trimmerSrc && (
        <AudioTrimmer
          audioSrc={trimmerSrc}
          onConfirm={handleTrimConfirm}
          onCancel={handleTrimCancel}
          lang={lang}
        />
      )}
    </div>
  );
}
