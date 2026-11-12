'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  Flame,
  Flag,
  Heart,
  Plus,
  Search,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { createGoal, deleteGoal, updateGoal } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { useShallow } from '@/lib/useAppShallow';
import type { Goal } from '@/lib/types';
import { parseLocalDate, toLocalDateKey } from '@/lib/localDate';

type ChartView = 'day' | 'month' | 'quarter' | 'year';
type GoalFormType = Goal['goal_type'] | 'general';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfWeek(date: Date) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  value.setDate(value.getDate() - ((value.getDay() + 1) % 7));
  return value;
}

function endOfWeek(date: Date) {
  const value = startOfWeek(date);
  value.setDate(value.getDate() + 6);
  return value;
}

export default function Goals() {
  const { goals, sessions, tasks, settings, projects, addGoal, updateGoal: updateGoalInStore, removeGoal, addToast, darkMode, lang } = useAppStore(useShallow((state) => ({
    goals: state.goals,
    sessions: state.sessions,
    tasks: state.tasks,
    settings: state.settings,
    projects: state.projects,
    addGoal: state.addGoal,
    updateGoal: state.updateGoal,
    removeGoal: state.removeGoal,
    addToast: state.addToast,
    darkMode: state.darkMode,
    lang: state.language || 'ar',
  })));
  const t = useT();
  const ar = lang === 'ar';
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalFormType, setGoalFormType] = useState<GoalFormType>('daily_hours');
  const [targetValue, setTargetValue] = useState('');
  const [goalProjectId, setGoalProjectId] = useState<string | null>(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [error, setError] = useState('');
  const [chartView, setChartView] = useState<ChartView>('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pendingCreate = useAppStore((state) => state.pendingCreate);
  const setPendingCreate = useAppStore((state) => state.setPendingCreate);

  const c = ar ? {
    title: 'الأهداف', subtitle: 'تابع أهدافك وحقق تقدمًا نحو رؤيتك', add: 'إضافة هدف', todayHours: 'ساعات اليوم', todayHoursHint: 'ساعات من اليوم', streak: 'أيام متتالية', streakHint: 'أيام متبقية على نهاية الأسبوع', daysWorked: 'أيام العمل', completion: 'نسبة الإنجاز', completionHint: 'من إجمالي الأهداف', performance: 'أداء الأهداف', performanceHint: 'تحليل شامل لتقدم الأهداف خلال الفترة المحددة', completedGoals: 'عدد الأهداف المكتملة', totalProgress: 'نسبة التقدم الإجمالي', day: 'يوم', month: 'شهر', quarter: 'أشهر', year: 'سنة', daily: 'يومي', goalsList: 'قائمة الأهداف', goalsListHint: 'إدارة وتتبع جميع أهدافك ومهامك', search: 'ابحث عن هدف...', allStatuses: 'جميع الحالات', complete: 'مكتمل', active: 'في المسار', goal: 'الهدف', type: 'النوع', progress: 'التقدم', achieved: 'المحقق / المستهدف', due: 'تاريخ الاستحقاق', status: 'الحالة', actions: 'الإجراءات', noGoals: 'لا توجد أهداف مطابقة', noGoalsHint: 'أضف هدفك الأول لبدء تتبع تقدمك.', quick: 'نظرة سريعة', quickHint: 'ملخص سريع لحالة أهدافك الرئيسية', dailyHours: 'ساعات يومية', weeklyHours: 'ساعات أسبوعية', dailyTasks: 'مهام يومية', weeklyTasks: 'مهام أسبوعية', general: 'هدف عام بدون وقت', generalTitle: 'عنوان الهدف', generalDescription: 'وصف الهدف (اختياري)', targetDate: 'تاريخ مستهدف (اختياري)', target: 'المستهدف', project: 'المشروع', noProject: 'بدون مشروع', create: 'إضافة الهدف', save: 'حفظ التعديلات', cancel: 'إلغاء', edit: 'تعديل الهدف', remove: 'حذف الهدف', hours: 'ساعات', tasks: 'مهام', dueToday: 'اليوم', onTrack: 'في المسار', goalDescription: 'هدف إنتاجية محسوب من نشاطك الحقيقي', page: 'صفحة', of: 'من', show: 'عرض', perPage: 'لكل صفحة', disabled: 'الأهداف معطلة من الإعدادات',
  } : {
    title: 'Goals', subtitle: 'Track your goals and move toward your vision', add: 'Add Goal', todayHours: 'Today hours', todayHoursHint: 'hours today', streak: 'Current streak', streakHint: 'days remaining in this week', daysWorked: 'Days worked', completion: 'Completion rate', completionHint: 'of all goals', performance: 'Goal Performance', performanceHint: 'A complete view of goal progress during the selected period', completedGoals: 'Completed goals', totalProgress: 'Overall progress', day: 'Day', month: 'Month', quarter: 'Quarter', year: 'Year', daily: 'Daily', goalsList: 'Goals List', goalsListHint: 'Manage and track all goals', search: 'Search goals...', allStatuses: 'All statuses', complete: 'Completed', active: 'On track', goal: 'Goal', type: 'Type', progress: 'Progress', achieved: 'Actual / Target', due: 'Due date', status: 'Status', actions: 'Actions', noGoals: 'No matching goals', noGoalsHint: 'Add your first goal to start tracking progress.', quick: 'Quick Overview', quickHint: 'A quick summary of your main goals', dailyHours: 'Daily Hours', weeklyHours: 'Weekly Hours', dailyTasks: 'Daily Tasks', weeklyTasks: 'Weekly Tasks', general: 'General goal without time', generalTitle: 'Goal title', generalDescription: 'Description (optional)', targetDate: 'Target date (optional)', target: 'Target', project: 'Project', noProject: 'No project', create: 'Add Goal', save: 'Save changes', cancel: 'Cancel', edit: 'Edit Goal', remove: 'Delete Goal', hours: 'hours', tasks: 'tasks', dueToday: 'Today', onTrack: 'On track', goalDescription: 'A productivity goal calculated from your real activity', page: 'Page', of: 'of', show: 'Show', perPage: 'per page', disabled: 'Goals are disabled in Settings',
  };

  const months = ar ? MONTHS_AR : MONTHS_EN;
  const actualProjects = useMemo(() => projects.filter((project) => !project.is_folder), [projects]);
  const goalTypes = useMemo(() => ([
    { value: 'daily_hours' as const, label: c.dailyHours, unit: c.hours, icon: Clock3, color: '#2563eb' },
    { value: 'weekly_hours' as const, label: c.weeklyHours, unit: c.hours, icon: BriefcaseBusiness, color: '#7c3aed' },
    { value: 'daily_tasks' as const, label: c.dailyTasks, unit: c.tasks, icon: Heart, color: '#f97316' },
    { value: 'weekly_tasks' as const, label: c.weeklyTasks, unit: c.tasks, icon: CheckCircle2, color: '#16a34a' },
    { value: 'general' as const, label: c.general, unit: ar ? 'هدف' : 'goal', icon: Flag, color: '#ec4899' },
  ]), [ar, c.dailyHours, c.dailyTasks, c.general, c.hours, c.tasks, c.weeklyHours, c.weeklyTasks]);

  const getGoalType = (type: GoalFormType) => goalTypes.find((item) => item.value === type) || goalTypes[0];
  const getGoalFormType = (goal: Goal): GoalFormType => goal.goal_kind === 'general' ? 'general' : goal.goal_type;
  const getProject = (id: string | null) => actualProjects.find((project) => project.id === id);
  const getGoalTitle = (goal: Goal) => {
    const project = getProject(goal.project_id);
    if (goal.goal_kind === 'general') return goal.title || c.general;
    return project ? `${getGoalType(goal.goal_type).label} — ${project.name}` : getGoalType(goal.goal_type).label;
  };

  const getActualAt = (goal: Goal, date: Date) => {
    if (goal.goal_kind === 'general') return goal.is_completed ? 1 : 0;
    const dateKey = toLocalDateKey(date);
    const weekStart = toLocalDateKey(startOfWeek(date));
    const scopedSessions = goal.project_id ? sessions.filter((session) => session.project_id === goal.project_id) : sessions;
    const scopedTasks = goal.project_id ? tasks.filter((task) => task.project_id === goal.project_id) : tasks;
    if (goal.goal_type === 'daily_hours') return scopedSessions.filter((session) => session.session_date === dateKey).reduce((sum, session) => sum + session.duration, 0) / 60;
    if (goal.goal_type === 'weekly_hours') return scopedSessions.filter((session) => session.session_date >= weekStart && session.session_date <= dateKey).reduce((sum, session) => sum + session.duration, 0) / 60;
    const completedDates = scopedTasks.filter((task) => task.is_completed && task.updated_at).map((task) => ({ task, date: toLocalDateKey(new Date(task.updated_at!)) }));
    if (goal.goal_type === 'daily_tasks') return completedDates.filter((entry) => entry.date === dateKey).length;
    return completedDates.filter((entry) => entry.date >= weekStart && entry.date <= dateKey).length;
  };

  const getProgressAt = (goal: Goal, date: Date) => Math.min(100, Math.round((getActualAt(goal, date) / goal.target_value) * 100) || 0);
  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const progressById = new Map<string, number>(goals.map((goal) => [goal.id, getProgressAt(goal, today)]));
  const averageCompletion = goals.length ? Math.round(goals.reduce((sum, goal) => sum + (progressById.get(goal.id) || 0), 0) / goals.length) : 0;
  const todayMinutes = sessions.filter((session) => session.session_date === todayKey).reduce((sum, session) => sum + session.duration, 0);

  const streak = useMemo(() => {
    const dates = new Set(sessions.map((session) => session.session_date));
    const cursor = new Date();
    if (!dates.has(toLocalDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    while (dates.has(toLocalDateKey(cursor))) { count += 1; cursor.setDate(cursor.getDate() - 1); }
    return count;
  }, [sessions]);

  const daysWorked = useMemo(() => new Set(sessions.filter((session) => {
    const date = parseLocalDate(session.session_date);
    return date.getFullYear() === selectedYear && date.getMonth() + 1 === selectedMonth;
  }).map((session) => session.session_date)).size, [sessions, selectedYear, selectedMonth]);

  const chartDates = (() => {
    if (chartView === 'day') return Array.from({ length: 7 }, (_, index) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index)));
    if (chartView === 'month') return Array.from({ length: new Date(selectedYear, selectedMonth, 0).getDate() }, (_, index) => new Date(selectedYear, selectedMonth - 1, index + 1));
    if (chartView === 'quarter') return Array.from({ length: 3 }, (_, index) => new Date(selectedYear, selectedMonth - 3 + index, 1));
    return Array.from({ length: 12 }, (_, index) => new Date(selectedYear, index, 1));
  })();

  const chartData = chartDates.map((date) => {
    const periodGoals = goals.filter((goal) => parseLocalDate(goal.created_at.slice(0, 10)) <= date || goal.created_at.slice(0, 10) === toLocalDateKey(date));
    const progressValues = periodGoals.map((goal) => getProgressAt(goal, chartView === 'quarter' || chartView === 'year' ? new Date(date.getFullYear(), date.getMonth() + 1, 0) : date));
    return {
      name: chartView === 'month' ? String(date.getDate()) : chartView === 'day' ? date.toLocaleDateString(ar ? 'ar-EG' : 'en-US', { weekday: 'short' }) : months[date.getMonth()],
      completed: progressValues.filter((value) => value >= 100).length,
      progress: progressValues.length ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length) : 0,
    };
  });

  const filteredGoals = goals.filter((goal) => {
    const progress = progressById.get(goal.id) || 0;
    if (statusFilter === 'completed' && progress < 100) return false;
    if (statusFilter === 'active' && progress >= 100) return false;
    const text = `${getGoalTitle(goal)} ${getProject(goal.project_id)?.name || ''}`.toLocaleLowerCase();
    return text.includes(search.trim().toLocaleLowerCase());
  });

  const totalPages = Math.max(1, Math.ceil(filteredGoals.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleGoals = filteredGoals.slice((safePage - 1) * pageSize, safePage * pageSize);

  const resetForm = () => { setEditingGoal(null); setGoalFormType('daily_hours'); setTargetValue(''); setGoalProjectId(null); setGoalTitle(''); setGoalDescription(''); setGoalTargetDate(''); setError(''); };
  const openCreate = () => { resetForm(); setShowModal(true); };
  const openEdit = (goal: Goal) => { setEditingGoal(goal); setGoalFormType(getGoalFormType(goal)); setTargetValue(String(goal.target_value)); setGoalProjectId(goal.project_id); setGoalTitle(goal.title || ''); setGoalDescription(goal.description || ''); setGoalTargetDate(goal.target_date || ''); setError(''); setShowModal(true); };

  useEffect(() => {
    if (pendingCreate !== 'goal') return;
    const frame = requestAnimationFrame(() => {
      resetForm(); setShowModal(true); setPendingCreate(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingCreate, setPendingCreate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const isGeneral = goalFormType === 'general';
    const value = isGeneral ? 1 : Number(targetValue);
    if (isGeneral && !goalTitle.trim()) { setError(ar ? 'اكتب عنوان الهدف' : 'Enter a goal title'); return; }
    if (!isGeneral && (!value || value <= 0)) { setError(ar ? 'أدخل قيمة صحيحة أكبر من صفر' : 'Enter a valid value greater than zero'); return; }
    const metricType = isGeneral ? 'daily_tasks' : goalFormType;
    const payload = isGeneral ? {
      goal_type: metricType as Goal['goal_type'], target_value: 1, project_id: goalProjectId,
      goal_kind: 'general' as const, title: goalTitle.trim(), description: goalDescription.trim() || null,
      target_date: goalTargetDate || null, is_completed: editingGoal?.is_completed || false,
    } : editingGoal?.goal_kind === 'general' ? {
      goal_type: metricType as Goal['goal_type'], target_value: value, project_id: goalProjectId,
      goal_kind: 'metric' as const, title: null, description: null, target_date: null, is_completed: false,
    } : {
      // Keep existing metric-goal creation compatible before the optional
      // general-goals migration is manually reviewed and applied.
      goal_type: metricType as Goal['goal_type'], target_value: value, project_id: goalProjectId,
    };
    try {
      if (editingGoal) {
        const updated = await updateGoal(editingGoal.id, useAppStore.getState().userId || '', payload);
        updateGoalInStore(updated);
      } else {
        const created = await createGoal(useAppStore.getState().userId || '', payload);
        addGoal(created);
      }
      addToast(t('toast.saved'), 'success');
      setShowModal(false);
      resetForm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('toast.error'));
      addToast(t('toast.error'), 'error');
    }
  };
  const handleDelete = (id: string) => {
    if (!confirm(t('goals.deleteConfirm'))) return;
    const goal = goals.find((item) => item.id === id);
    if (!goal) return;
    const userId = useAppStore.getState().userId || '';
    removeGoal(id);
    let undone = false;
    const timeout = window.setTimeout(async () => {
      if (undone) return;
      try { await deleteGoal(id, userId); }
      catch {
        if (useAppStore.getState().userId === userId) {
          useAppStore.getState().addGoal(goal);
          addToast(t('toast.error'), 'error');
        }
      }
    }, 6000);
    addToast(t('toast.deleted'), 'info', {
      actionLabel: ar ? 'تراجع' : 'Undo', duration: 6000,
      onAction: () => { undone = true; window.clearTimeout(timeout); addGoal(goal); },
    });
  };

  const toggleGeneralGoal = async (goal: Goal) => {
    try {
      const updated = await updateGoal(goal.id, useAppStore.getState().userId || '', { is_completed: !goal.is_completed });
      updateGoalInStore(updated);
      addToast(t('toast.saved'), 'success');
    } catch { addToast(t('toast.error'), 'error'); }
  };

  if (settings?.enable_goals === false) return <div className="grid min-h-[65vh] place-items-center"><div className="text-center"><Target size={48} className="mx-auto mb-4 text-slate-300" /><p className="font-bold text-slate-400">{c.disabled}</p></div></div>;

  const tooltipStyle = { background: darkMode ? '#0f172a' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 12, color: darkMode ? '#f8fafc' : '#0f172a' };
  const grid = darkMode ? '#334155' : '#e8edf4';
  const tick = darkMode ? '#94a3b8' : '#64748b';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-4 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-3"><Target size={29} className="text-violet-600" /><h1 className="text-3xl font-black text-slate-900 dark:text-white">{c.title}</h1></div><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{c.subtitle}</p></div><button onClick={openCreate} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 text-sm font-black text-white transition hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-violet-300"><Plus size={18} />{c.add}</button></header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock3} color="blue" label={c.todayHours} value={(todayMinutes / 60).toFixed(1)} note={c.todayHoursHint} />
        <StatCard icon={Flame} color="orange" label={c.streak} value={String(streak)} note={c.streakHint} />
        <StatCard icon={CalendarDays} color="emerald" label={c.daysWorked} value={String(daysWorked)} note={`${months[selectedMonth - 1]} ${selectedYear}`} />
        <article className="flex min-h-28 items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"><div><p className="text-xs font-bold text-slate-500 dark:text-slate-400">{c.completion}</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{averageCompletion}%</p><p className="mt-1 text-xs text-slate-400">{c.completionHint}</p></div><ProgressRing value={averageCompletion} color="#4f46e5" /></article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="text-xl font-black text-slate-900 dark:text-white">{c.performance}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.performanceHint}</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-700">{(['day', 'month', 'quarter', 'year'] as ChartView[]).map((view) => <button key={view} onClick={() => setChartView(view)} className={`h-9 rounded-lg px-4 text-xs font-bold transition ${chartView === view ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-600'}`}>{view === 'day' ? c.day : view === 'month' ? c.month : view === 'quarter' ? c.quarter : c.year}</button>)}</div><select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">{Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 3 + index).map((year) => <option key={year}>{year}</option>)}</select>{chartView === 'month' || chartView === 'quarter' ? <select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select> : null}</div></div>
        <div className="mb-2 flex justify-end gap-5 text-xs font-bold text-slate-500"><span className="flex items-center gap-2"><i className="h-0.5 w-6 border-t-2 border-dashed border-violet-500" />{c.totalProgress}</span><span className="flex items-center gap-2"><i className="h-2.5 w-6 rounded bg-violet-400" />{c.completedGoals}</span></div>
        <div className="h-[330px] w-full"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={100}><ComposedChart data={chartData} margin={{ top: 15, right: 10, left: 0, bottom: 0 }}><defs><linearGradient id="goalBars" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c3aed" stopOpacity={0.8} /><stop offset="100%" stopColor="#c4b5fd" stopOpacity={0.55} /></linearGradient></defs><CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: tick, fontSize: 11 }} interval={chartView === 'month' ? 2 : 0} /><YAxis yAxisId="count" axisLine={false} tickLine={false} tick={{ fill: tick, fontSize: 11 }} allowDecimals={false} /><YAxis yAxisId="percent" orientation="right" domain={[0, 100]} hide /><Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [name === 'progress' ? `${value}%` : value, name === 'progress' ? c.totalProgress : c.completedGoals]} /><Bar yAxisId="count" dataKey="completed" fill="url(#goalBars)" radius={[6, 6, 0, 0]} maxBarSize={32} /><Line yAxisId="percent" type="monotone" dataKey="progress" stroke="#8b5cf6" strokeWidth={2.5} strokeDasharray="7 6" dot={false} activeDot={{ r: 5 }} /></ComposedChart></ResponsiveContainer></div>
      </section>

      {goals.some((goal) => goal.goal_kind === 'general') && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#26334a] dark:bg-[#111a2a]">
        <div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-300"><Flag size={19} /></span><div><h2 className="font-black text-slate-900 dark:text-white">{c.general}</h2><p className="text-xs text-slate-500 dark:text-slate-400">{ar ? 'أهداف مرنة لا تعتمد على عدد ساعات أو مهام' : 'Flexible goals without time or task totals'}</p></div></div>
        <div className="grid gap-2 sm:grid-cols-2">{goals.filter((goal) => goal.goal_kind === 'general').map((goal) => <button type="button" key={goal.id} onClick={() => toggleGeneralGoal(goal)} className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${goal.is_completed ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 dark:border-[#26334a] dark:hover:bg-[#18243a]'}`}><CheckCircle2 size={20} className={goal.is_completed ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-500'} /><span className="min-w-0 flex-1"><span className={`block truncate text-sm font-black ${goal.is_completed ? 'text-emerald-700 line-through dark:text-emerald-300' : 'text-slate-800 dark:text-white'}`}>{goal.title}</span>{goal.target_date && <span className="mt-0.5 block text-xs text-slate-400">{goal.target_date}</span>}</span></button>)}</div>
      </section>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 dark:border-slate-700 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-xl font-black text-slate-900 dark:text-white">{c.goalsList}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.goalsListHint}</p></div><div className="flex flex-wrap gap-2"><label className="relative min-w-56 flex-1"><Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={c.search} className="h-11 w-full rounded-xl border border-slate-200 bg-white pe-3 ps-10 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-600 dark:bg-slate-900" /></label><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-11 min-w-40 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"><option value="all">{c.allStatuses}</option><option value="active">{c.active}</option><option value="completed">{c.complete}</option></select></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1080px] table-fixed text-start"><colgroup><col className="w-[28%]" /><col className="w-[12%]" /><col className="w-[18%]" /><col className="w-[14%]" /><col className="w-[13%]" /><col className="w-[10%]" /><col className="w-[5%]" /></colgroup><thead className="bg-slate-50 text-xs font-bold text-slate-500 dark:bg-slate-950 dark:text-slate-300"><tr><th className="px-5 py-4 text-start">{c.goal}</th><th className="px-4 py-4 text-start">{c.type}</th><th className="px-4 py-4 text-start">{c.progress}</th><th className="px-4 py-4 text-start">{c.achieved}</th><th className="px-4 py-4 text-start">{c.due}</th><th className="px-4 py-4 text-start">{c.status}</th><th className="px-4 py-4 text-center">{c.actions}</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{visibleGoals.length === 0 ? <tr><td colSpan={7} className="px-5 py-16 text-center"><Target size={36} className="mx-auto mb-3 text-slate-300" /><p className="font-bold text-slate-500">{c.noGoals}</p><p className="mt-1 text-xs text-slate-400">{c.noGoalsHint}</p></td></tr> : visibleGoals.map((goal) => {
          const formType = getGoalFormType(goal); const info = getGoalType(formType); const Icon = info.icon; const actual = getActualAt(goal, today); const progress = progressById.get(goal.id) || 0; const completed = progress >= 100; const dueDate = goal.goal_kind === 'general' && goal.target_date ? parseLocalDate(goal.target_date) : goal.goal_type.startsWith('daily') ? today : endOfWeek(today);
          return <tr key={goal.id} className="transition hover:bg-violet-50/35 dark:hover:bg-violet-500/5"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ color: info.color, backgroundColor: `${info.color}14` }}><Icon size={19} /></span><div className="min-w-0"><p className="truncate font-black text-slate-900 dark:text-white">{getGoalTitle(goal)}</p><p className="mt-1 truncate text-xs text-slate-400">{c.goalDescription}</p></div></div></td><td className="px-4 py-4"><span className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200"><Icon size={14} style={{ color: info.color }} />{goal.goal_type.includes('hours') ? (ar ? 'عمل' : 'Work') : (ar ? 'مهام' : 'Tasks')}</span></td><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="h-2.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-700"><motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full rounded-full" style={{ backgroundColor: completed ? '#16a34a' : info.color }} /></div><b className="w-9 text-xs text-slate-600 dark:text-slate-200">{progress}%</b></div></td><td className="px-4 py-4"><p className="text-sm font-black text-slate-800 dark:text-slate-100">{Number(actual.toFixed(1))} / {goal.target_value}</p><p className="mt-0.5 text-xs text-slate-400">{info.unit}</p></td><td className="px-4 py-4"><div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300"><CalendarDays size={15} className="text-slate-400" />{dueDate.toLocaleDateString(ar ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</div></td><td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${completed ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'}`}><i className="h-1.5 w-1.5 rounded-full bg-current" />{completed ? c.complete : c.onTrack}</span></td><td className="px-4 py-4"><div className="flex justify-center gap-1"><button onClick={() => openEdit(goal)} aria-label={c.edit} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-slate-700"><Edit3 size={16} /></button><button onClick={() => handleDelete(goal.id)} aria-label={c.remove} className="grid h-9 w-9 place-items-center rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 size={16} /></button></div></td></tr>;
        })}</tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-700"><div className="flex items-center gap-2"><span>{c.show}</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-9 rounded-lg border border-slate-200 bg-white px-2 font-bold dark:border-slate-600 dark:bg-slate-900"><option>5</option><option>10</option><option>20</option></select><span>{c.perPage}</span></div><div className="flex items-center gap-2"><span>{c.page} {safePage} {c.of} {totalPages}</span><button disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-30 dark:border-slate-600">‹</button><button disabled={safePage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-30 dark:border-slate-600">›</button></div></div>
      </section>

      <AnimatePresence>{showModal && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} onClick={() => setShowModal(false)} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
        <motion.div role="dialog" aria-modal="true" initial={{ opacity: 0, scale: 0.985, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.985, y: 6 }} transition={{ duration: 0.12, ease: 'easeOut' }} onClick={(event) => event.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#26334a] dark:bg-[#111a2a]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-[#26334a]"><div><h2 className="text-xl font-black text-slate-900 dark:text-white">{editingGoal ? c.edit : c.add}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{goalFormType === 'general' ? c.general : c.goalDescription}</p></div><button type="button" onClick={() => setShowModal(false)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#18243a]"><X size={18} /></button></div>
          <form onSubmit={handleSubmit} className="space-y-5 p-6">
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{c.type}</span><select value={goalFormType} onChange={(event) => { setGoalFormType(event.target.value as GoalFormType); setError(''); }} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-[#26334a] dark:bg-[#0d1422] dark:text-white">{goalTypes.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            {goalFormType === 'general' ? <>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{c.generalTitle}</span><input autoFocus value={goalTitle} onChange={(event) => { setGoalTitle(event.target.value); setError(''); }} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-[#26334a] dark:bg-[#0d1422] dark:text-white" /></label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{c.generalDescription}</span><textarea rows={3} value={goalDescription} onChange={(event) => setGoalDescription(event.target.value)} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-[#26334a] dark:bg-[#0d1422] dark:text-white" /></label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{c.targetDate}</span><input type="date" value={goalTargetDate} onChange={(event) => setGoalTargetDate(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-[#26334a] dark:bg-[#0d1422] dark:text-white" /></label>
            </> : <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{c.target} ({getGoalType(goalFormType).unit})</span><input autoFocus type="number" min="0" step="0.5" value={targetValue} onChange={(event) => { setTargetValue(event.target.value); setError(''); }} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-[#26334a] dark:bg-[#0d1422] dark:text-white" /></label>}
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{c.project}</span><select value={goalProjectId || ''} onChange={(event) => setGoalProjectId(event.target.value || null)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 dark:border-[#26334a] dark:bg-[#0d1422] dark:text-white"><option value="">{c.noProject}</option>{actualProjects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
            {error && <p role="alert" className="text-xs font-bold text-red-500">{error}</p>}
            <div className="flex gap-3 pt-2"><button type="submit" className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-black text-white transition hover:bg-violet-700">{editingGoal ? c.save : c.create}</button><button type="button" onClick={() => setShowModal(false)} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-600 dark:bg-[#18243a] dark:text-slate-200">{c.cancel}</button></div>
          </form>
        </motion.div>
      </motion.div>}</AnimatePresence>
    </motion.div>
  );
}

function StatCard({ icon: Icon, color, label, value, note }: { icon: typeof Clock3; color: 'blue' | 'orange' | 'emerald'; label: string; value: string; note: string }) {
  const tones = { blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300', orange: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300', emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' };
  return <article className="flex min-h-28 items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"><div><p className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{value}</p><p className="mt-1 text-xs text-slate-400">{note}</p></div><span className={`grid h-14 w-14 place-items-center rounded-2xl ${tones[color]}`}><Icon size={25} /></span></article>;
}

function ProgressRing({ value, color, small = false }: { value: number; color: string; small?: boolean }) {
  const size = small ? 62 : 74;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return <div className="relative shrink-0" style={{ width: size, height: size }}><svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-100 dark:text-slate-700" /><circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - (circumference * Math.min(100, value)) / 100} /></svg><span className="absolute inset-0 grid place-items-center text-xs font-black" style={{ color }}>{value}%</span></div>;
}
