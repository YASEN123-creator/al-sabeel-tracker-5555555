'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, RotateCcw, Clock, Edit3, Trash2, X, Plus, Minus, CalendarDays, Search, Settings2, Activity, Trophy, Gauge, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { updateSession, deleteSession, upsertSettings, createSession } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Session } from '@/lib/types';
import { SkeletonChart } from '@/components/Skeleton';
import { useShallow } from '@/lib/useAppShallow';
import { toLocalDateKey } from '@/lib/localDate';
import DateRangePicker from '@/components/DateRangePicker';
import ProjectPicker from '@/components/ProjectPicker';

// ── Live Clock Component ─────────────────────────────────────────────────

function LiveClock({ darkMode, lang }: { darkMode: boolean; lang: string }) {
  const [timeParts, setTimeParts] = useState<{ hours: number; minutes: number; seconds: number; hours12: number; ampm: string; dateStr: string } | null>(null);
  const isAr = lang === 'ar';
  const TZ = 'Africa/Cairo';

  useEffect(() => {
    function tick() {
      const now = new Date();
      // Force Africa/Cairo timezone for all calculations
      const hours = parseInt(now.toLocaleString('en-US', { timeZone: TZ, hour: '2-digit', hour12: false }));
      const minutes = parseInt(now.toLocaleString('en-US', { timeZone: TZ, minute: '2-digit' }));
      const seconds = parseInt(now.toLocaleString('en-US', { timeZone: TZ, second: '2-digit' }));
      const hours12 = hours % 12 || 12;
      const ampm = hours >= 12 ? 'م' : 'ص';
      const dateStr = now.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
        timeZone: TZ,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      setTimeParts({ hours, minutes, seconds, hours12, ampm, dateStr });
    }

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isAr]);

  if (!timeParts) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-52">
        <div className="w-40 h-40 rounded-full border-4 border-gray-200 dark:border-slate-700 animate-pulse" />
        <div className="flex gap-2">
          <div className="w-16 h-8 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" />
          <div className="w-10 h-8 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const { minutes, seconds, hours12, ampm, dateStr } = timeParts;

  // Analog clock angles
  const secondAngle = seconds * 6;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const hourAngle = (hours12 * 30) + (minutes * 0.5);

  const timeStr = `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const secStr = String(seconds).padStart(2, '0');

  const faceColor = darkMode ? '#1e293b' : '#ffffff';
  const borderColor = darkMode ? '#334155' : '#e2e8f0';
  const tickColor = darkMode ? '#475569' : '#cbd5e1';
  const hourHandColor = darkMode ? '#e2e8f0' : '#1e293b';
  const minuteHandColor = darkMode ? '#94a3b8' : '#475569';
  const secondHandColor = '#3b82f6';
  const centerDot = '#3b82f6';
  const numberColor = darkMode ? '#94a3b8' : '#64748b';

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Analog Clock */}
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Face */}
          <circle cx="100" cy="100" r="95" fill={faceColor} stroke={borderColor} strokeWidth="2" />

          {/* Outer ring accent */}
          <circle cx="100" cy="100" r="95" fill="none" stroke={secondHandColor} strokeWidth="1.5" strokeDasharray="4 6" opacity="0.3" />

          {/* Hour ticks */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = i * 30;
            const rad = (angle - 90) * (Math.PI / 180);
            const x1 = 100 + 82 * Math.cos(rad);
            const y1 = 100 + 82 * Math.sin(rad);
            const x2 = 100 + 92 * Math.cos(rad);
            const y2 = 100 + 92 * Math.sin(rad);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={numberColor} strokeWidth="2" strokeLinecap="round" />;
          })}

          {/* Minute ticks */}
          {Array.from({ length: 60 }).map((_, i) => {
            if (i % 5 === 0) return null;
            const angle = i * 6;
            const rad = (angle - 90) * (Math.PI / 180);
            const x1 = 100 + 87 * Math.cos(rad);
            const y1 = 100 + 87 * Math.sin(rad);
            const x2 = 100 + 92 * Math.cos(rad);
            const y2 = 100 + 92 * Math.sin(rad);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={tickColor} strokeWidth="1" strokeLinecap="round" />;
          })}

          {/* Hour numbers */}
          {Array.from({ length: 12 }).map((_, i) => {
            const num = i === 0 ? 12 : i;
            const angle = (i * 30 - 90) * (Math.PI / 180);
            const x = 100 + 70 * Math.cos(angle);
            const y = 100 + 70 * Math.sin(angle);
            return (
              <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="central"
                fill={numberColor} fontSize="13" fontWeight="600" fontFamily="Tajawal, sans-serif">
                {num}
              </text>
            );
          })}

          {/* Hour hand */}
          <line
            x1="100" y1="100"
            x2={100 + 45 * Math.cos((hourAngle - 90) * Math.PI / 180)}
            y2={100 + 45 * Math.sin((hourAngle - 90) * Math.PI / 180)}
            stroke={hourHandColor} strokeWidth="4" strokeLinecap="round"
          />

          {/* Minute hand */}
          <line
            x1="100" y1="100"
            x2={100 + 60 * Math.cos((minuteAngle - 90) * Math.PI / 180)}
            y2={100 + 60 * Math.sin((minuteAngle - 90) * Math.PI / 180)}
            stroke={minuteHandColor} strokeWidth="3" strokeLinecap="round"
          />

          {/* Second hand */}
          <line
            x1={100 - 12 * Math.cos((secondAngle - 90) * Math.PI / 180)}
            y1={100 - 12 * Math.sin((secondAngle - 90) * Math.PI / 180)}
            x2={100 + 68 * Math.cos((secondAngle - 90) * Math.PI / 180)}
            y2={100 + 68 * Math.sin((secondAngle - 90) * Math.PI / 180)}
            stroke={secondHandColor} strokeWidth="1.5" strokeLinecap="round"
          />

          {/* Center dot */}
          <circle cx="100" cy="100" r="4" fill={centerDot} />
          <circle cx="100" cy="100" r="2" fill={faceColor} />
        </svg>
      </div>

      {/* Digital Time */}
      <div className="text-center">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold text-slate-800 dark:text-slate-100 font-mono tracking-wider">
            {timeStr}
          </span>
          <span className="text-lg font-medium text-blue-500 dark:text-blue-400 font-mono">{secStr}</span>
          <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 ml-1">{ampm}</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          <CalendarDays size={12} />
          <span>{dateStr}</span>
        </div>
      </div>
    </div>
  );
}

// ── Sessions Page ────────────────────────────────────────────────────────────

export default function Sessions() {
  const {
    sessions, projects, tasks, settings, sessionPlans,
    updateSession: updateSessionInStore, removeSession, addSession,
    timerState, timerSeconds,
    activeProjectId, setActiveProjectId, activeTaskId, setActiveTaskId,
    setSettings, dataLoading, addToast, darkMode, language, setSessionPlan,
  } = useAppStore(useShallow((state) => ({
    sessions: state.sessions,
    projects: state.projects,
    tasks: state.tasks,
    settings: state.settings,
    sessionPlans: state.sessionPlans,
    updateSession: state.updateSession,
    removeSession: state.removeSession,
    addSession: state.addSession,
    timerState: state.timerState,
    timerSeconds: state.timerSeconds,
    activeProjectId: state.activeProjectId,
    setActiveProjectId: state.setActiveProjectId,
    activeTaskId: state.activeTaskId,
    setActiveTaskId: state.setActiveTaskId,
    setSettings: state.setSettings,
    dataLoading: state.dataLoading,
    addToast: state.addToast,
    darkMode: state.darkMode,
    language: state.language,
    setSessionPlan: state.setSessionPlan,
  })));
  const t = useT();
  const lang = language || 'ar';

  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editDuration, setEditDuration] = useState(0);
  const [editPlannedDuration, setEditPlannedDuration] = useState(0);

  // Add Session Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addProjectId, setAddProjectId] = useState<string | null>(null);
  const [addTaskId, setAddTaskId] = useState<string | null>(null);
  const [addDate, setAddDate] = useState(toLocalDateKey());
  const [addStartTime, setAddStartTime] = useState('12:00');
  const [addEndTime, setAddEndTime] = useState('13:00');
  const [addDuration, setAddDuration] = useState(60);
  const [addPlannedDuration, setAddPlannedDuration] = useState(60);

  // Filters
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterTask, setFilterTask] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const pendingCreate = useAppStore((state) => state.pendingCreate);
  const setPendingCreate = useAppStore((state) => state.setPendingCreate);

  const isPomodoroEnabled = settings?.enable_pomodoro !== false;
  const workMin = settings?.pomodoro_work_duration || 25;
  const breakMin = settings?.pomodoro_break_duration || 5;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const changeWorkDuration = async (delta: number) => {
    const newVal = Math.max(1, Math.min(120, workMin + delta));
    const userId = useAppStore.getState().userId || '';
    try {
      const updated = await upsertSettings(userId, { pomodoro_work_duration: newVal });
      setSettings(updated);
    } catch { addToast(t('toast.error'), 'error'); }
  };

  const changeBreakDuration = async (delta: number) => {
    const newVal = Math.max(1, Math.min(60, breakMin + delta));
    const userId = useAppStore.getState().userId || '';
    try {
      const updated = await upsertSettings(userId, { pomodoro_break_duration: newVal });
      setSettings(updated);
    } catch { addToast(t('toast.error'), 'error'); }
  };

  const statusLabel = timerState === 'break' ? t('sess.break') : timerState === 'running' ? t('sess.running') : timerState === 'paused' ? t('sess.paused') : t('sess.ready');

  const c = lang === 'ar' ? {
    search: 'ابحث في الجلسات...', allTypes: 'كل الجلسات', completed: 'مكتملة', active: 'جارية', allTasks: 'كل المهام',
    timer: 'المؤقت', timerHint: 'جلسة تركيز جديدة', start: 'بدء الجلسة', resume: 'استئناف الجلسة', pause: 'إيقاف مؤقت',
    currentTime: 'الوقت الحالي', todaySummary: 'ملخص اليوم', totalTime: 'إجمالي الوقت', sessionCount: 'عدد الجلسات', average: 'متوسط الجلسة', longest: 'أطول جلسة',
    projectTask: 'المشروع / المهمة', startTime: 'بداية الجلسة', endTime: 'نهاية الجلسة', duration: 'المدة الفعلية', plannedDuration: 'الوقت المخطط', status: 'الحالة', actions: 'الإجراءات',
    noEnd: 'قيد التشغيل', edit: 'تعديل الجلسة', remove: 'حذف الجلسة', ready: 'جاهز للبدء', perPage: 'لكل صفحة',
  } : {
    search: 'Search sessions...', allTypes: 'All sessions', completed: 'Completed', active: 'Running', allTasks: 'All tasks',
    timer: 'Timer', timerHint: 'New focus session', start: 'Start session', resume: 'Resume session', pause: 'Pause session',
    currentTime: 'Current time', todaySummary: 'Today summary', totalTime: 'Total time', sessionCount: 'Sessions', average: 'Average session', longest: 'Longest session',
    projectTask: 'Project / task', startTime: 'Start time', endTime: 'End time', duration: 'Actual time', plannedDuration: 'Planned time', status: 'Status', actions: 'Actions',
    noEnd: 'Running', edit: 'Edit session', remove: 'Delete session', ready: 'Ready to start', perPage: 'per page',
  };

  const projectName = (id: string | null) => projects.find((project) => project.id === id)?.name || t('common.noProject');
  const taskName = (id: string | null) => tasks.find((task) => task.id === id)?.title || t('sess.noTask');
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours) return lang === 'ar' ? `${rest} د` : `${rest}m`;
    return lang === 'ar' ? `${hours} س${rest ? ` ${rest} د` : ''}` : `${hours}h${rest ? ` ${rest}m` : ''}`;
  };
  const formatClockTime = (value: string | null) => value ? new Date(value).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : c.noEnd;

  const applyQuickRange = (range: 'today' | 'week' | 'month') => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === 'week') start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
    if (range === 'month') start.setDate(1);
    setDateRange({ start: toLocalDateKey(start), end: toLocalDateKey(now) });
    setCurrentPage(1);
  };

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filterProject !== 'all' && s.project_id !== filterProject) return false;
      if (filterTask !== 'all' && s.task_id !== filterTask) return false;
      if (filterType === 'completed' && !s.end_time) return false;
      if (filterType === 'active' && s.end_time) return false;
      if (dateRange.start && s.session_date < dateRange.start) return false;
      if (dateRange.end && s.session_date > dateRange.end) return false;
      if (searchQuery.trim()) {
        const project = projects.find((item) => item.id === s.project_id)?.name || '';
        const task = tasks.find((item) => item.id === s.task_id)?.title || '';
        const text = `${project} ${task}`.toLocaleLowerCase();
        if (!text.includes(searchQuery.trim().toLocaleLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [sessions, filterProject, filterTask, filterType, dateRange, searchQuery, projects, tasks]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const visibleSessions = filteredSessions.slice((safePage - 1) * pageSize, safePage * pageSize);
  const todaySessions = sessions.filter((session) => session.session_date === toLocalDateKey());
  const todayMinutes = todaySessions.reduce((sum, session) => sum + session.duration, 0);
  const averageMinutes = todaySessions.length ? Math.round(todayMinutes / todaySessions.length) : 0;
  const longestMinutes = todaySessions.reduce((longest, session) => Math.max(longest, session.duration), 0);

  const openEditSession = (session: Session) => {
    setEditingSession(session);
    setEditProjectId(session.project_id);
    setEditDate(session.session_date);
    setEditStartTime(session.start_time?.slice(11, 16) || '');
    setEditEndTime(session.end_time?.slice(11, 16) || '');
    setEditDuration(session.duration);
    setEditPlannedDuration(sessionPlans[session.id] || session.duration);
    setShowModal(true);
  };

  const openAddSession = () => {
    setAddProjectId(null);
    setAddTaskId(null);
    setAddDate(toLocalDateKey());
    setAddStartTime('12:00');
    setAddEndTime('13:00');
    setAddDuration(60);
    setAddPlannedDuration(60);
    setShowAddModal(true);
  };

  useEffect(() => {
    if (pendingCreate !== 'session') return;
    const frame = requestAnimationFrame(() => {
      setAddProjectId(null); setAddTaskId(null); setAddDate(toLocalDateKey());
      setAddStartTime('12:00'); setAddEndTime('13:00'); setAddDuration(60); setAddPlannedDuration(60);
      setShowAddModal(true); setPendingCreate(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingCreate, setPendingCreate]);

  const handleAddSession = async () => {
    if (addDuration <= 0) return;
    try {
      const session = await createSession(useAppStore.getState().userId || '', {
        project_id: addProjectId,
        task_id: addTaskId,
        start_time: addDate + 'T' + addStartTime + ':00',
        end_time: addEndTime ? addDate + 'T' + addEndTime + ':00' : null,
        duration: addDuration,
        session_date: addDate,
      });
      addSession(session);
      if (!setSessionPlan(session.id, addPlannedDuration)) addToast(t('toast.error'), 'error');
      setShowAddModal(false);
      addToast(t('sess.addSessionSuccess'), 'success');
    } catch { addToast(t('toast.error'), 'error'); }
  };

  const handleSaveEdit = async () => {
    if (!editingSession) return;
    try {
      const updates: Partial<Session> = {
        project_id: editProjectId,
        session_date: editDate,
        duration: editDuration,
        start_time: editDate + 'T' + editStartTime + ':00',
        end_time: editEndTime ? editDate + 'T' + editEndTime + ':00' : null,
      };
     const updated = await updateSession(editingSession.id, useAppStore.getState().userId || '', updates);
      updateSessionInStore(updated);
      if (!setSessionPlan(updated.id, editPlannedDuration)) addToast(t('toast.error'), 'error');
      setShowModal(false);
      addToast(t('toast.saved'), 'success');
    } catch { addToast(t('toast.error'), 'error'); }
  };

  const handleDeleteSession = (id: string) => {
    if (!confirm(t('sess.deleteConfirm'))) return;
    const session = sessions.find((item) => item.id === id);
    if (!session) return;
    const userId = useAppStore.getState().userId || '';
    removeSession(id);
    let undone = false;
    const timeout = window.setTimeout(async () => {
      if (undone) return;
      try { await deleteSession(id, userId); }
      catch {
        if (useAppStore.getState().userId === userId) {
          useAppStore.getState().addSession(session);
          addToast(t('toast.error'), 'error');
        }
      }
    }, 6000);
    addToast(t('toast.deleted'), 'info', {
      actionLabel: lang === 'ar' ? 'تراجع' : 'Undo', duration: 6000,
      onAction: () => { undone = true; window.clearTimeout(timeout); addSession(session); },
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="w-full">
      <header className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="ps-14 md:ps-0"><h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{t('sess.title')}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('sess.subtitle')}</p></div>
        <label className="relative block w-full lg:max-w-sm"><Search size={17} className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} placeholder={c.search} className="h-11 w-full rounded-xl border border-slate-200 bg-white pe-10 ps-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900" /></label>
      </header>

      <div className="mb-5 grid gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 xl:grid-cols-4">
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }} aria-label={c.allTypes} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="all">{c.allTypes}</option><option value="completed">{c.completed}</option><option value="active">{c.active}</option></select>
        <select value={filterTask} onChange={(e) => { setFilterTask(e.target.value); setCurrentPage(1); }} aria-label={c.allTasks} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="all">{c.allTasks}</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select>
        <ProjectPicker projects={projects} value={filterProject} onChange={(nextValue) => { setFilterProject(nextValue); setCurrentPage(1); }} language={lang} placeholder={t('sess.allProjects')} ariaLabel={t('sess.allProjects')} specialOption={{ value: 'all', label: t('sess.allProjects') }} className="h-11" />
        <DateRangePicker value={dateRange} language={lang} onApply={(range) => { setDateRange(range); setCurrentPage(1); }} />
      </div>

      <div className={`mb-5 grid gap-4 ${isPomodoroEnabled ? 'lg:grid-cols-[1.2fr_0.9fr_0.9fr]' : 'lg:grid-cols-2'}`}>
        {isPomodoroEnabled && <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-[0_5px_20px_rgba(37,99,235,0.06)] dark:border-blue-900 dark:bg-slate-900">
          <div className="flex items-start justify-between"><div><h2 className="font-extrabold text-slate-900 dark:text-white">{c.timer}</h2><p className="mt-1 text-xs text-slate-400">{c.timerHint}</p></div><div className="flex gap-2"><button onClick={() => setShowTimerSettings((value) => !value)} aria-label={t('settings.title')} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:hover:bg-slate-800"><Settings2 size={18} /></button><button onClick={() => useAppStore.getState().resetTimer?.()} aria-label={t('sess.reset')} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:hover:bg-slate-800"><RotateCcw size={18} /></button></div></div>
          <div className="py-5 text-center"><p className="font-mono text-5xl font-extrabold tracking-[0.08em] text-slate-900 dark:text-white">{formatTime(timerSeconds)}</p><span className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"><i className={`h-2 w-2 rounded-full ${timerState === 'running' ? 'animate-pulse bg-emerald-500' : timerState === 'paused' ? 'bg-amber-500' : 'bg-slate-400'}`} />{statusLabel}</span></div>
          <AnimatePresence>{showTimerSettings && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><div className="flex flex-wrap justify-center gap-4"><div className="flex items-center gap-2"><button onClick={() => changeWorkDuration(-5)} className="grid h-8 w-8 place-items-center rounded-lg bg-white dark:bg-slate-800"><Minus size={14} /></button><span className="text-xs font-bold">{t('sess.workDuration')} {workMin}</span><button onClick={() => changeWorkDuration(5)} className="grid h-8 w-8 place-items-center rounded-lg bg-white dark:bg-slate-800"><Plus size={14} /></button></div><div className="flex items-center gap-2"><button onClick={() => changeBreakDuration(-1)} className="grid h-8 w-8 place-items-center rounded-lg bg-white dark:bg-slate-800"><Minus size={14} /></button><span className="text-xs font-bold">{t('sess.breakDuration')} {breakMin}</span><button onClick={() => changeBreakDuration(1)} className="grid h-8 w-8 place-items-center rounded-lg bg-white dark:bg-slate-800"><Plus size={14} /></button></div></div></motion.div>}</AnimatePresence>
          <button onClick={() => timerState === 'running' || timerState === 'break' ? useAppStore.getState().pauseTimer?.() : timerState === 'paused' ? useAppStore.getState().resumeTimer?.() : useAppStore.getState().startTimer?.()} className="mx-auto flex h-11 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 focus-visible:ring-4 focus-visible:ring-blue-500/25 dark:bg-blue-600">{timerState === 'running' || timerState === 'break' ? <Pause size={18} /> : <Play size={18} />}{timerState === 'running' || timerState === 'break' ? c.pause : timerState === 'paused' ? c.resume : c.start}</button>
          <div className="mt-4 grid grid-cols-2 gap-2"><ProjectPicker projects={projects} value={activeProjectId || ''} onChange={(nextValue) => setActiveProjectId(nextValue || null)} language={lang} placeholder={t('sess.selectProject')} ariaLabel={t('sess.selectProject')} specialOption={{ value: '', label: t('common.noProject') }} className="h-10" /><select value={activeTaskId || ''} onChange={(e) => setActiveTaskId(e.target.value || null)} className="h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950"><option value="">{t('sess.selectTask')}</option>{tasks.filter((task) => !task.is_completed).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></div>
          <div className="mt-3 flex justify-center gap-2"><button onClick={() => useAppStore.getState().skipTimer?.()} aria-label={t('sess.skip')} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><SkipForward size={16} /></button></div>
        </section>}

        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="font-extrabold text-slate-900 dark:text-white">{c.currentTime}</h2><div className="flex flex-1 items-center justify-center py-3"><LiveClock darkMode={darkMode} lang={lang} /></div></section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="font-extrabold text-slate-900 dark:text-white">{c.todaySummary}</h2><div className="mt-4 space-y-3">{[
          { label: c.totalTime, value: formatDuration(todayMinutes), icon: Clock, tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300' },
          { label: c.sessionCount, value: String(todaySessions.length), icon: Activity, tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' },
          { label: c.average, value: formatDuration(averageMinutes), icon: Gauge, tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300' },
          { label: c.longest, value: formatDuration(longestMinutes), icon: Trophy, tone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300' },
        ].map(({ label, value, icon: Icon, tone }) => <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-950/70"><div><p className="text-[11px] font-medium text-slate-400">{label}</p><p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{value}</p></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={19} /></span></div>)}</div></section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3"><h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{t('sess.history')}</h2><button onClick={openAddSession} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white dark:bg-blue-600"><Plus size={16} />{t('sess.addSession')}</button></div><div className="flex flex-wrap gap-2"><button onClick={() => applyQuickRange('today')} className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">{t('sess.today')}</button><button onClick={() => applyQuickRange('week')} className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">{t('sess.thisWeek')}</button><button onClick={() => applyQuickRange('month')} className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">{t('sess.thisMonth')}</button></div></div>

        {dataLoading ? <div className="p-5"><SkeletonChart /></div> : visibleSessions.length === 0 ? <div className="grid min-h-64 place-items-center p-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10"><Clock size={26} /></span><p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">{t('sess.noSessions')}</p><button onClick={openAddSession} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white dark:bg-blue-600"><Plus size={16} />{t('sess.addSession')}</button></div></div> : <>
          <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[900px] text-start"><thead className="bg-slate-50 text-xs font-bold text-slate-500 dark:bg-slate-950 dark:text-slate-300"><tr><th className="px-5 py-3.5 text-start">{c.projectTask}</th><th className="px-4 py-3.5 text-start">{c.startTime}</th><th className="px-4 py-3.5 text-start">{c.endTime}</th><th className="px-4 py-3.5 text-start">{c.duration}</th><th className="px-4 py-3.5 text-start">{c.plannedDuration}</th><th className="px-4 py-3.5 text-start">{c.status}</th><th className="px-4 py-3.5 text-center">{c.actions}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{visibleSessions.map((session) => { const project = projects.find((item) => item.id === session.project_id); return <tr key={session.id} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/50"><td className="px-5 py-3"><div className="flex items-center gap-3"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project?.color || '#94a3b8' }} /><div><p className="text-sm font-bold text-slate-800 dark:text-slate-100">{projectName(session.project_id)}</p><p className="mt-0.5 text-xs text-slate-400">{taskName(session.task_id)}</p></div></div></td><td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300"><b className="block">{formatClockTime(session.start_time)}</b><span className="text-xs text-slate-400">{session.session_date}</span></td><td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{formatClockTime(session.end_time)}</td><td className="px-4 py-3 text-sm font-extrabold text-slate-800 dark:text-slate-100">{formatDuration(session.duration)}</td><td className="px-4 py-3 text-sm font-bold text-slate-500 dark:text-slate-300">{sessionPlans[session.id] ? formatDuration(sessionPlans[session.id]) : '—'}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${session.end_time ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}><i className={`h-1.5 w-1.5 rounded-full ${session.end_time ? 'bg-emerald-500' : 'animate-pulse bg-amber-500'}`} />{session.end_time ? c.completed : c.active}</span></td><td className="px-4 py-3"><div className="flex justify-center gap-1"><button onClick={() => openEditSession(session)} aria-label={c.edit} className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800"><Edit3 size={16} /></button><button onClick={() => handleDeleteSession(session.id)} aria-label={c.remove} className="grid h-10 w-10 place-items-center rounded-xl text-red-400 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-500/10"><Trash2 size={16} /></button></div></td></tr>; })}</tbody></table></div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 lg:hidden">{visibleSessions.map((session) => <article key={session.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-800 dark:text-slate-100">{projectName(session.project_id)}</p><p className="mt-1 text-xs text-slate-400">{taskName(session.task_id)}</p></div><span className={`rounded-lg px-2 py-1 text-xs font-bold ${session.end_time ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>{session.end_time ? c.completed : c.active}</span></div><div className="mt-3 grid grid-cols-2 gap-2 rounded-xl sm:grid-cols-4 bg-slate-50 p-3 text-center text-xs dark:bg-slate-950"><div><span className="block text-slate-400">{c.startTime}</span><b>{formatClockTime(session.start_time)}</b></div><div><span className="block text-slate-400">{c.endTime}</span><b>{formatClockTime(session.end_time)}</b></div><div><span className="block text-slate-400">{c.duration}</span><b>{formatDuration(session.duration)}</b></div><div><span className="block text-slate-400">{c.plannedDuration}</span><b>{sessionPlans[session.id] ? formatDuration(sessionPlans[session.id]) : '—'}</b></div></div><div className="mt-3 flex gap-2"><button onClick={() => openEditSession(session)} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold dark:border-slate-700"><Edit3 size={15} />{c.edit}</button><button onClick={() => handleDeleteSession(session.id)} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 text-sm font-bold text-red-600 dark:border-red-900"><Trash2 size={15} />{c.remove}</button></div></article>)}</div>
          <footer className="flex flex-col gap-3 border-t border-slate-100 p-4 text-sm text-slate-500 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="h-9 rounded-lg border border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-950"><option value="5">5</option><option value="10">10</option><option value="20">20</option></select><span>{c.perPage}</span></div><div className="flex items-center gap-2"><span>{t('sess.showing')} {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredSessions.length)} {t('sess.of')} {filteredSessions.length}</span><button disabled={safePage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-35 dark:border-slate-700">{lang === 'ar' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button><b className="grid h-9 min-w-9 place-items-center rounded-lg bg-slate-900 px-2 text-white dark:bg-blue-600">{safePage}</b><button disabled={safePage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-35 dark:border-slate-700">{lang === 'ar' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button></div></footer>
        </>}
      </section>

      {/* Edit Modal */}
      <AnimatePresence>
        {showModal && editingSession && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="global-modal-overlay" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.985, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.985, opacity: 0 }} transition={{ duration: 0.12, ease: 'easeOut' }} onClick={(e) => e.stopPropagation()} className="global-modal-panel w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('sess.editSession')}</h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"><X size={18} className="text-gray-400 dark:text-gray-500" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{t('sess.selectProject')}</label>
                  <ProjectPicker projects={projects} value={editProjectId || ''} onChange={(nextValue) => setEditProjectId(nextValue || null)} language={lang} placeholder={t('sess.selectProject')} ariaLabel={t('sess.selectProject')} specialOption={{ value: '', label: t('common.noProject') }} className="h-11" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{t('sess.date')}</label>
                  <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none text-slate-800 dark:text-slate-100" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{t('sess.startTime')}</label>
                    <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none text-slate-800 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{t('sess.endTime')}</label>
                    <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none text-slate-800 dark:text-slate-100" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{t('sess.duration')}</label>
                  <input type="number" value={editDuration} onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none text-slate-800 dark:text-slate-100" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{c.plannedDuration}</label>
                  <input type="number" value={editPlannedDuration} onChange={(e) => setEditPlannedDuration(parseInt(e.target.value) || 0)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none text-slate-800 dark:text-slate-100" min="0" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleSaveEdit} className="flex-1 py-2.5 bg-slate-800 dark:bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-slate-700 dark:hover:bg-blue-700 transition-colors">{t('sess.saveEdit')}</button>
                  <button onClick={() => setShowModal(false)} className="px-4 py-2.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">{t('proj.cancel')}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Session Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="global-modal-overlay" onClick={() => setShowAddModal(false)}>
            <motion.div initial={{ scale: 0.985, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.985, opacity: 0 }} transition={{ duration: 0.12, ease: 'easeOut' }} onClick={(e) => e.stopPropagation()} className="global-modal-panel w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('sess.addSessionTitle')}</h2>
                <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"><X size={18} className="text-gray-400 dark:text-gray-500" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{t('sess.selectProject')}</label>
                  <ProjectPicker projects={projects} value={addProjectId || ''} onChange={(nextValue) => setAddProjectId(nextValue || null)} language={lang} placeholder={t('sess.selectProject')} ariaLabel={t('sess.selectProject')} specialOption={{ value: '', label: t('common.noProject') }} className="h-11" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{t('sess.taskName')}</label>
                  <select value={addTaskId || ''} onChange={(e) => setAddTaskId(e.target.value || null)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 focus:outline-none text-slate-800 dark:text-slate-100">
                    <option value="">{t('sess.selectTask')}</option>
                    {tasks.filter((t) => !t.is_completed).map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{t('sess.date')}</label>
                  <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none text-slate-800 dark:text-slate-100" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{t('sess.startTime')}</label>
                    <input type="time" value={addStartTime} onChange={(e) => setAddStartTime(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none text-slate-800 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{t('sess.endTime')}</label>
                    <input type="time" value={addEndTime} onChange={(e) => setAddEndTime(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none text-slate-800 dark:text-slate-100" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{t('sess.duration')}</label>
                  <input type="number" value={addDuration} onChange={(e) => setAddDuration(parseInt(e.target.value) || 0)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none text-slate-800 dark:text-slate-100" min="1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{c.plannedDuration}</label>
                  <input type="number" value={addPlannedDuration} onChange={(e) => setAddPlannedDuration(parseInt(e.target.value) || 0)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none text-slate-800 dark:text-slate-100" min="1" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleAddSession} className="flex-1 py-2.5 bg-slate-800 dark:bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-slate-700 dark:hover:bg-blue-700 transition-colors">{t('sess.addSession')}</button>
                  <button onClick={() => setShowAddModal(false)} className="px-4 py-2.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">{t('proj.cancel')}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
