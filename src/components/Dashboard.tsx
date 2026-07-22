'use client';

import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  FolderKanban,
  Grid2X2,
  Info,
  Pause,
  Play,
  Settings,
  Target,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useShallow } from '@/lib/useAppShallow';
import { parseLocalDate, toLocalDateKey } from '@/lib/localDate';
import { SkeletonChart, SkeletonGrid } from '@/components/Skeleton';
import DateRangePicker from '@/components/DateRangePicker';
import type { Session } from '@/lib/types';

const MONTHS = {
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const COPY = {
  ar: {
    greeting: 'مرحباً', guest: 'بك', welcome: 'لديك يوم منتج في انتظارك. لنبدأ مع التركيز والإنجاز.',
    overview: 'نظرة عامة', allProjects: 'جميع المشاريع', allSessions: 'كل الجلسات', completedSessions: 'الجلسات المكتملة', openSessions: 'الجلسات المفتوحة',
    filter: 'تصفية', month: 'الشهر', day: 'اليوم', allDays: 'كل الأيام',
    focusHours: 'ساعات التركيز', focusSessions: 'جلسات التركيز', completedTasks: 'المهام المكتملة', averageSession: 'متوسط الجلسة',
    hour: 'ساعة', session: 'جلسة', task: 'مهمة', minute: 'دقيقة', previousWeek: 'عن الأسبوع الماضي',
    focusOverview: 'نظرة عامة على التركيز', focusHoursLine: 'ساعات التركيز', movingAverage: 'المتوسط المتحرك (7 أيام)', hours: 'ساعات', sevenDays: '7 أيام', thirtyDays: '30 يوم', ninetyDays: '90 يوم',
    goalsProjects: 'الأهداف والمشاريع', projectGoal: 'الهدف / المشروع', progress: 'التقدم', tasks: 'المهام', focusHoursColumn: 'ساعات التركيز', dueDate: 'الموعد النهائي',
    viewAllGoals: 'عرض جميع الأهداف', noProjects: 'لا توجد مشاريع لعرضها', noProjectsHint: 'أضف مشروعاً وابدأ تسجيل جلسات ليظهر تقدمه هنا.',
    weeklyActivity: 'نشاط الفترة المحددة', low: 'منخفض', high: 'مرتفع', noActivity: 'لا يوجد نشاط مسجل في الفترة المحددة.',
    timer: 'ابدأ جلسة', start: 'بدء', pause: 'إيقاف', resume: 'استئناف',
    notifications: 'الإشعارات', settings: 'الإعدادات', noData: 'لا توجد بيانات لهذه الفترة',
  },
  en: {
    greeting: 'Welcome', guest: 'back', welcome: 'A productive day is waiting for you. Let’s begin with focus and progress.',
    overview: 'Overview', allProjects: 'All projects', allSessions: 'All sessions', completedSessions: 'Completed sessions', openSessions: 'Open sessions',
    filter: 'Filter', month: 'Month', day: 'Day', allDays: 'All days',
    focusHours: 'Focus Hours', focusSessions: 'Focus Sessions', completedTasks: 'Completed Tasks', averageSession: 'Average Session',
    hour: 'hour', session: 'session', task: 'task', minute: 'minute', previousWeek: 'from last week',
    focusOverview: 'Focus Overview', focusHoursLine: 'Focus hours', movingAverage: '7-day moving average', hours: 'Hours', sevenDays: '7 days', thirtyDays: '30 days', ninetyDays: '90 days',
    goalsProjects: 'Goals & Projects', projectGoal: 'Goal / Project', progress: 'Progress', tasks: 'Tasks', focusHoursColumn: 'Focus Hours', dueDate: 'Due Date',
    viewAllGoals: 'View all goals', noProjects: 'No projects to show', noProjectsHint: 'Add a project and record sessions to see its progress here.',
    weeklyActivity: 'Selected Period Activity', low: 'Low', high: 'High', noActivity: 'No activity recorded in the selected period.',
    timer: 'Start Session', start: 'Start', pause: 'Pause', resume: 'Resume',
    notifications: 'Notifications', settings: 'Settings', noData: 'No data for this period',
  },
} as const;

const cardClass = 'rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.045)] dark:border-slate-700/80 dark:bg-slate-800';
const subscribeToHydration = () => () => {};
const HEAT_COLORS = ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#2563eb'];

function dayOffset(date: Date, offset: number) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  value.setDate(value.getDate() + offset);
  return value;
}

function sessionMinutes(items: Session[]) {
  return items.reduce((sum, session) => sum + session.duration, 0);
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remaining = Math.max(0, seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`${cardClass} ${className}`}>{children}</section>;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const maximum = Math.max(...values, 1);
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${30 - (value / maximum) * 24}`).join(' ');
  return <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="h-9 w-full" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>;
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center"><Target size={34} className="mb-3 text-slate-300 dark:text-slate-600" /><p className="font-bold text-slate-600 dark:text-slate-300">{title}</p>{hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}</div>;
}

export default function Dashboard() {
  const {
    sessions, projects, tasks, notifications, userEmail, dataLoading, darkMode, language,
    timerState, timerSeconds, setActiveView,
  } = useAppStore(useShallow((state) => ({
    sessions: state.sessions,
    projects: state.projects,
    tasks: state.tasks,
    notifications: state.notifications,
    userEmail: state.userEmail,
    dataLoading: state.dataLoading,
    darkMode: state.darkMode,
    language: state.language,
    timerState: state.timerState,
    timerSeconds: state.timerSeconds,
    setActiveView: state.setActiveView,
  })));

  const lang: 'ar' | 'en' = language === 'en' ? 'en' : 'ar';
  const copy = COPY[lang];
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [today] = useState(() => new Date());
  const [focusRange, setFocusRange] = useState<{ start: string | null; end: string | null }>(() => ({ start: toLocalDateKey(dayOffset(today, -29)), end: toLocalDateKey(today) }));
  const [focusPreset, setFocusPreset] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [activityRange, setActivityRange] = useState<{ start: string | null; end: string | null }>(() => ({ start: toLocalDateKey(dayOffset(today, -6)), end: toLocalDateKey(today) }));
  const [activityPreset, setActivityPreset] = useState<'7' | '30' | '90' | 'custom'>('7');
  const [selectedProject, setSelectedProject] = useState('all');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'completed' | 'open'>('all');
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const actualProjects = useMemo(() => projects.filter((project) => !project.is_folder), [projects]);
  const scopedSessions = useMemo(() => sessions.filter((session) => selectedProject === 'all' || session.project_id === selectedProject), [sessions, selectedProject]);
  const scopedTasks = useMemo(() => tasks.filter((task) => selectedProject === 'all' || task.project_id === selectedProject), [tasks, selectedProject]);
  const filteredSessions = useMemo(() => scopedSessions.filter((session) => {
    const date = parseLocalDate(session.session_date);
    const inDate = date.getFullYear() === selectedYear && date.getMonth() + 1 === selectedMonth && (selectedDay === null || date.getDate() === selectedDay);
    if (!inDate) return false;
    if (sessionFilter === 'completed') return Boolean(session.end_time);
    if (sessionFilter === 'open') return !session.end_time;
    return true;
  }), [scopedSessions, selectedYear, selectedMonth, selectedDay, sessionFilter]);

  const applyPreset = (days: number, setRange: (value: { start: string | null; end: string | null }) => void) => {
    setRange({ start: toLocalDateKey(dayOffset(today, -(days - 1))), end: toLocalDateKey(today) });
  };

  const daysForRange = (range: { start: string | null; end: string | null }) => {
    const end = range.end ? parseLocalDate(range.end) : today;
    const start = range.start ? parseLocalDate(range.start) : dayOffset(end, -6);
    const days = [];
    const cursor = new Date(start);
    while (cursor <= end && days.length < 730) {
      const date = new Date(cursor);
      const key = toLocalDateKey(date);
      const daySessions = scopedSessions.filter((session) => session.session_date === key);
      days.push({ key, date, label: date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }), fullDate: date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }), minutes: sessionMinutes(daySessions), count: daySessions.length });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  };

  const lastSevenDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = dayOffset(today, index - 6);
    const key = toLocalDateKey(date);
    const daySessions = scopedSessions.filter((session) => session.session_date === key);
    return { key, date, label: date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }), minutes: sessionMinutes(daySessions), count: daySessions.length };
  }), [scopedSessions, lang, today]);

  const focusDays = useMemo(() => daysForRange(focusRange), [focusRange, scopedSessions, lang, today]);
  const activityDays = useMemo(() => daysForRange(activityRange), [activityRange, scopedSessions, lang, today]);

  const previousSevenDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const key = toLocalDateKey(dayOffset(today, index - 13));
    return scopedSessions.filter((session) => session.session_date === key);
  }).flat(), [scopedSessions, today]);

  const selectedMinutes = sessionMinutes(filteredSessions);
  const previousMinutes = sessionMinutes(previousSevenDays);
  const completedTaskCount = scopedTasks.filter((task) => task.is_completed).length;
  const previousCompletedTasks = scopedTasks.filter((task) => task.is_completed && task.updated_at.slice(0, 10) >= toLocalDateKey(dayOffset(today, -13)) && task.updated_at.slice(0, 10) <= toLocalDateKey(dayOffset(today, -7))).length;
  const recentCompletedTasks = scopedTasks.filter((task) => task.is_completed && task.updated_at.slice(0, 10) >= toLocalDateKey(dayOffset(today, -6))).length;
  const averageSession = filteredSessions.length ? Math.round(selectedMinutes / filteredSessions.length) : 0;
  const previousAverage = previousSevenDays.length ? Math.round(previousMinutes / previousSevenDays.length) : 0;

  const chartData = focusDays.map((day, index, all) => {
    const start = Math.max(0, index - 6);
    const average = all.slice(start, index + 1).reduce((sum, item) => sum + item.minutes, 0) / (index - start + 1);
    return { ...day, hours: Math.round(day.minutes / 6) / 10, average: Math.round(average / 6) / 10 };
  });

  const projectRows = useMemo(() => actualProjects.map((project) => {
    const projectSessions = filteredSessions.filter((session) => session.project_id === project.id);
    const projectTasks = tasks.filter((task) => task.project_id === project.id);
    const completed = projectTasks.filter((task) => task.is_completed).length;
    const due = projectTasks.filter((task) => !task.is_completed && task.due_date).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))[0]?.due_date || null;
    return { project, minutes: sessionMinutes(projectSessions), totalTasks: projectTasks.length, completed, progress: projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0, due };
  }).sort((a, b) => b.minutes - a.minutes), [actualProjects, filteredSessions, tasks]);

  const activityMatrix = useMemo(() => Array.from({ length: 6 }, (_, bucket) => activityDays.map((day) => scopedSessions.filter((session) => {
    if (session.session_date !== day.key) return false;
    const hour = new Date(session.start_time).getHours();
    return hour >= bucket * 4 && hour < bucket * 4 + 4;
  }).reduce((sum, session) => sum + session.duration, 0))), [activityDays, scopedSessions]);
  const maxActivity = Math.max(...activityMatrix.flat(), 0);

  const chartGrid = darkMode ? '#334155' : '#e2e8f0';
  const chartText = darkMode ? '#94a3b8' : '#64748b';
  const tooltipStyle = { backgroundColor: darkMode ? '#1e293b' : '#fff', border: `1px solid ${darkMode ? '#475569' : '#e2e8f0'}`, borderRadius: '12px', color: darkMode ? '#f8fafc' : '#0f172a', fontSize: '12px' };
  const unread = notifications.filter((notification) => !notification.read).length;
  const displayName = userEmail?.split('@')[0] || copy.guest;
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  const handleTimer = () => {
    const store = useAppStore.getState();
    if (timerState === 'running' || timerState === 'break') store.pauseTimer?.();
    else if (timerState === 'paused') store.resumeTimer?.();
    else if (store.startTimer) store.startTimer();
    else setActiveView('sessions');
  };

  const timerLabel = timerState === 'running' || timerState === 'break' ? copy.pause : timerState === 'paused' ? copy.resume : copy.start;
  const kpis = [
    { label: copy.focusHours, value: `${(selectedMinutes / 60).toFixed(1)}`, unit: copy.hour, change: percentChange(selectedMinutes, previousMinutes), icon: Clock3, color: '#16a34a', tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300', values: chartData.map((item) => item.hours) },
    { label: copy.focusSessions, value: filteredSessions.length, unit: copy.session, change: percentChange(filteredSessions.length, previousSevenDays.length), icon: FolderKanban, color: '#2563eb', tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300', values: chartData.map((item) => item.count) },
    { label: copy.completedTasks, value: completedTaskCount, unit: copy.task, change: percentChange(recentCompletedTasks, previousCompletedTasks), icon: CheckCircle2, color: '#16a34a', tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300', values: lastSevenDays.map((day) => scopedTasks.filter((task) => task.is_completed && task.updated_at.slice(0, 10) === day.key).length) },
    { label: copy.averageSession, value: averageSession, unit: copy.minute, change: percentChange(averageSession, previousAverage), icon: Target, color: '#7c3aed', tone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300', values: chartData.map((item) => item.count ? item.minutes / item.count : 0) },
  ];

  if (!hydrated || dataLoading) return <div className="space-y-6"><SkeletonGrid /><SkeletonChart /><SkeletonChart /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className="space-y-6 pb-10">
      <header className="flex min-h-24 flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="flex items-start gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{copy.greeting} {displayName} <span aria-hidden="true">👋</span></h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{copy.welcome}</p>
            <p className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-400"><CalendarDays size={14} />{today.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActiveView('notifications')} aria-label={copy.notifications} className="relative grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800"><Bell size={19} />{unread > 0 && <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}</button>
            <button onClick={() => setActiveView('settings')} aria-label={copy.settings} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800"><Settings size={19} /></button>
          </div>
        </div>
        <Card className="flex min-w-60 items-center gap-4 px-4 py-3">
          <button onClick={handleTimer} aria-label={timerLabel} className="grid h-11 w-11 place-items-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-500/20 transition hover:scale-105 focus-visible:ring-4 focus-visible:ring-violet-500/25">{timerState === 'running' || timerState === 'break' ? <Pause size={18} /> : <Play size={18} />}</button>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-700 dark:text-slate-200">{copy.timer}</p><p className="mt-0.5 font-mono text-lg font-black tracking-wider text-slate-900 dark:text-white">{formatTimer(timerSeconds)}</p></div>
          <span className={`h-2.5 w-2.5 rounded-full ${timerState === 'running' || timerState === 'break' ? 'animate-pulse bg-emerald-500' : timerState === 'paused' ? 'bg-amber-500' : 'bg-slate-300'}`} />
        </Card>
      </header>

      <Card className="flex min-h-20 flex-wrap items-center gap-3 p-4">
        <div className="flex min-w-44 flex-1 items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700"><Grid2X2 size={18} className="text-violet-600" /><span className="font-bold text-slate-800 dark:text-slate-100">{copy.overview}</span></div>
        <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{Array.from({ length: 5 }, (_, index) => today.getFullYear() - 2 + index).map((year) => <option key={year}>{year}</option>)}</select>
        <select value={selectedMonth} onChange={(event) => { setSelectedMonth(Number(event.target.value)); setSelectedDay(null); }} className="h-12 min-w-36 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{MONTHS[lang].map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select>
        <select value={selectedDay || ''} onChange={(event) => setSelectedDay(event.target.value ? Number(event.target.value) : null)} className="h-12 min-w-32 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><option value="">{copy.allDays}</option>{Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => <option key={day}>{day}</option>)}</select>
        <select value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)} className="h-12 min-w-48 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><option value="all">{copy.allProjects}</option>{actualProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        <select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value as 'all' | 'completed' | 'open')} className="h-12 min-w-44 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><option value="all">{copy.allSessions}</option><option value="completed">{copy.completedSessions}</option><option value="open">{copy.openSessions}</option></select>
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-slate-900 text-white dark:bg-violet-600" aria-label={copy.filter}><Filter size={18} /></span>
      </Card>

      <Card className="overflow-hidden">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return <motion.article key={kpi.label} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }} className="grid min-h-24 items-center gap-5 border-b border-slate-100 px-6 py-4 last:border-b-0 dark:border-slate-700 md:grid-cols-[minmax(220px,1fr)_minmax(180px,0.7fr)_minmax(260px,0.9fr)]"><div className="flex items-center gap-4"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${kpi.tone}`}><Icon size={22} /></span><p className="flex items-center gap-2 text-base font-black text-slate-700 dark:text-slate-200">{kpi.label}<Info size={13} className="text-slate-400" /></p></div><div className="flex items-center gap-3"><span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${kpi.change >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'}`}>{kpi.change >= 0 ? '+' : ''}{kpi.change}%</span><span className="text-xs font-medium text-slate-400">{copy.previousWeek}</span></div><div className="flex min-w-0 items-center gap-5"><div className="min-w-0 flex-1"><Sparkline values={kpi.values} color={kpi.color} /></div><div className="min-w-20 text-end"><p className="text-3xl font-black text-slate-900 dark:text-white">{kpi.value}</p><p className="mt-1 text-xs text-slate-400">{kpi.unit}</p></div></div></motion.article>;
        })}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-700"><div><h2 className="text-xl font-black text-slate-900 dark:text-white">{copy.focusOverview}</h2><div className="mt-3 flex flex-wrap gap-5 text-xs font-bold text-slate-500"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-blue-600" />{copy.focusHoursLine}</span><span className="flex items-center gap-2"><i className="w-7 border-t-2 border-dashed border-blue-400" />{copy.movingAverage}</span></div></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">{([['7', 7, copy.sevenDays], ['30', 30, copy.thirtyDays], ['90', 90, copy.ninetyDays]] as const).map(([id, days, label]) => <button key={id} type="button" onClick={() => { setFocusPreset(id); applyPreset(days, setFocusRange); }} className={`h-9 rounded-lg px-3 text-xs font-black transition ${focusPreset === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'}`}>{label}</button>)}</div><div className="min-w-64"><DateRangePicker value={focusRange} language={lang} onApply={(range) => { setFocusRange(range); setFocusPreset('custom'); }} /></div></div></div>
        {chartData.some((item) => item.hours > 0) ? <div className="h-[370px] px-4 pb-5 pt-4 sm:px-6"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={100}><AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><defs><linearGradient id="dashboardFocusArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke={chartGrid} strokeDasharray="3 4" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: chartText, fontSize: 11 }} minTickGap={22} /><YAxis axisLine={false} tickLine={false} tick={{ fill: chartText, fontSize: 11 }} width={28} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}h`, copy.hours]} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''} /><Area type="monotone" dataKey="hours" stroke="#2563eb" strokeWidth={2.5} fill="url(#dashboardFocusArea)" dot={chartData.length <= 31 ? { fill: '#2563eb', stroke: '#fff', strokeWidth: 2, r: 4 } : false} /><Area type="monotone" dataKey="average" stroke="#60a5fa" strokeWidth={2} strokeDasharray="6 5" fill="transparent" dot={false} /></AreaChart></ResponsiveContainer></div> : <EmptyState title={copy.noData} />}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-700"><h2 className="text-xl font-black text-slate-900 dark:text-white">{copy.goalsProjects}</h2><button onClick={() => setActiveView('goals')} className="text-xs font-bold text-violet-600 hover:text-violet-700 dark:text-violet-300">{copy.viewAllGoals}</button></div>
        {projectRows.length === 0 ? <EmptyState title={copy.noProjects} hint={copy.noProjectsHint} /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400"><tr><th className="px-6 py-4 text-start font-bold">{copy.projectGoal}</th><th className="px-5 py-4 text-start font-bold">{copy.progress}</th><th className="px-5 py-4 text-start font-bold">{copy.tasks}</th><th className="px-5 py-4 text-start font-bold">{copy.focusHoursColumn}</th><th className="px-5 py-4 text-start font-bold">{copy.dueDate}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{projectRows.slice(0, 8).map(({ project, minutes, totalTasks, completed, progress, due }) => <tr key={project.id} onClick={() => setActiveView('projects')} className="cursor-pointer transition hover:bg-blue-50/40 dark:hover:bg-slate-700/35"><td className="px-6 py-5"><div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color || '#64748b' }} /><div><p className="font-black text-slate-800 dark:text-slate-100">{project.name}</p>{project.description && <p className="mt-1 max-w-md truncate text-xs text-slate-400">{project.description}</p>}</div></div></td><td className="px-5 py-5"><div className="flex min-w-40 items-center gap-3"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: project.color || '#2563eb' }} /></div><b className="w-10 text-xs text-slate-600 dark:text-slate-300">{progress}%</b></div></td><td className="px-5 py-5 font-bold text-slate-700 dark:text-slate-200">{completed} / {totalTasks}</td><td className="px-5 py-5 font-bold text-slate-700 dark:text-slate-200">{(minutes / 60).toFixed(1)}h</td><td className="px-5 py-5 text-slate-500 dark:text-slate-400">{due ? parseLocalDate(due).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</td></tr>)}</tbody></table></div>}
      </Card>

      <Card className="min-h-[340px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-xl font-black text-slate-900 dark:text-white">{copy.weeklyActivity}</h2><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">{([['7', 7, copy.sevenDays], ['30', 30, copy.thirtyDays], ['90', 90, copy.ninetyDays]] as const).map(([id, days, label]) => <button key={id} type="button" onClick={() => { setActivityPreset(id); applyPreset(days, setActivityRange); }} className={`h-9 rounded-lg px-3 text-xs font-black transition ${activityPreset === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'}`}>{label}</button>)}</div><div className="min-w-64"><DateRangePicker value={activityRange} language={lang} onApply={(range) => { setActivityRange(range); setActivityPreset('custom'); }} /></div></div></div>
        {maxActivity === 0 ? <EmptyState title={copy.noActivity} /> : <div className="mt-7 overflow-x-auto"><div style={{ minWidth: Math.max(820, 110 + activityDays.length * 84) }}><div className="grid gap-3" style={{ gridTemplateColumns: `95px repeat(${activityDays.length}, minmax(72px, 1fr))` }}><span />{activityDays.map((day) => <span key={day.key} title={day.fullDate} className="text-center text-xs font-bold text-slate-500 dark:text-slate-400">{day.date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}</span>)}{activityMatrix.map((row, bucket) => <div className="contents" key={bucket}><span className="flex items-center text-xs font-bold text-slate-500 dark:text-slate-400">{`${String(bucket * 4).padStart(2, '0')}:00 – ${String(bucket * 4 + 4).padStart(2, '0')}:00`}</span>{row.map((minutes, dayIndex) => { const level = minutes === 0 ? 0 : Math.max(1, Math.ceil((minutes / maxActivity) * 5)); const day = activityDays[dayIndex]; return <div key={`${bucket}-${dayIndex}`} title={`${day.fullDate} · ${String(bucket * 4).padStart(2, '0')}:00–${String(bucket * 4 + 4).padStart(2, '0')}:00 · ${minutes} ${copy.minute}`} className="h-9 rounded-md border border-white/70 transition hover:scale-[1.03] hover:ring-2 hover:ring-blue-300 dark:border-slate-800" style={{ backgroundColor: HEAT_COLORS[level] }} />; })}</div>)}</div><div className="mt-7 flex items-center justify-center gap-2 text-xs font-bold text-slate-400"><span>{copy.low}</span>{HEAT_COLORS.map((color) => <i key={color} className="h-4 w-9 rounded" style={{ backgroundColor: color }} />)}<span>{copy.high}</span></div></div></div>}
      </Card>
    </motion.div>
  );
}
