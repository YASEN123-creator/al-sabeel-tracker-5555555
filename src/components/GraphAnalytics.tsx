'use client';

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart as AreaChartIcon,
  BarChart3,
  Download,
  Expand,
  LineChart as LineChartIcon,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import DateRangePicker from '@/components/DateRangePicker';
import { useAppStore } from '@/lib/store';
import { useShallow } from '@/lib/useAppShallow';
import { parseLocalDate, toLocalDateKey } from '@/lib/localDate';
import type { Session } from '@/lib/types';

type ChartKind = 'area' | 'line' | 'bar';

function lastSevenDays() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  return { start: toLocalDateKey(start), end: toLocalDateKey(today) };
}

function initialSessionRange(sessions: Session[]) {
  const recent = lastSevenDays();
  if (sessions.some((session) => session.session_date >= recent.start && session.session_date <= recent.end)) {
    return recent;
  }
  const dates = sessions.map((session) => session.session_date).sort();
  return dates.length ? { start: dates[0], end: dates[dates.length - 1] } : recent;
}

export default function GraphAnalytics() {
  const { sessions, projects, tasks, projectPlans, sessionPlans, language, darkMode, setActiveView } = useAppStore(useShallow((state) => ({
    sessions: state.sessions,
    projects: state.projects,
    tasks: state.tasks,
    projectPlans: state.projectPlans,
    sessionPlans: state.sessionPlans,
    language: state.language || 'ar',
    darkMode: state.darkMode,
    setActiveView: state.setActiveView,
  })));
  const lang = language || 'ar';
  const isArabic = lang === 'ar';
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>(() => initialSessionRange(sessions));
  const [projectId, setProjectId] = useState('all');
  const [taskId, setTaskId] = useState('all');
  const [sessionType, setSessionType] = useState('all');
  const [mainChart, setMainChart] = useState<ChartKind>('area');
  const chartCardRef = useRef<HTMLElement>(null);

  const c = isArabic ? {
    title: 'تحليلات الوقت', subtitle: 'تحليل شامل لجلساتك وإنتاجيتك', overview: 'نظرة عامة', charts: 'الجراف', distribution: 'تفاصيل المشاريع',
    allProjects: 'كل المشاريع', allTasks: 'كل المهام', allSessions: 'كل الجلسات', completed: 'مكتملة', running: 'جارية', export: 'تصدير', expand: 'تكبير',
    dailyHours: 'الساعات اليومية', dailyHoursHint: 'عدد الساعات التي عملتها كل يوم', sessionsOverTime: 'الجلسات عبر الوقت', sessionsHint: 'عدد الجلسات في كل يوم',
    averageDuration: 'متوسط مدة الجلسة', averageHint: 'متوسط المدة المخططة مقابل المدة الفعلية', planComparison: 'المخطط مقابل الفعلي', planComparisonHint: 'مقارنة وقت المشاريع المخطط بالوقت المسجل فعلياً', planned: 'المخطط', actual: 'الفعلي', projectsLabel: 'المشاريع في هذا اليوم', noProject: 'بدون مشروع', hours: 'الساعات', sessions: 'الجلسات', minutes: 'الدقائق', noData: 'لا توجد بيانات في الفترة المحددة',
  } : {
    title: 'Time Analytics', subtitle: 'A complete analysis of your sessions and productivity', overview: 'Overview', charts: 'Charts', distribution: 'Project details',
    allProjects: 'All projects', allTasks: 'All tasks', allSessions: 'All sessions', completed: 'Completed', running: 'Running', export: 'Export', expand: 'Expand',
    dailyHours: 'Daily hours', dailyHoursHint: 'Hours worked on each day', sessionsOverTime: 'Sessions over time', sessionsHint: 'Number of sessions per day',
    averageDuration: 'Average session duration', averageHint: 'Average planned duration compared with actual duration', planComparison: 'Planned vs actual', planComparisonHint: 'Compare each project plan with its recorded time', planned: 'Planned', actual: 'Actual', projectsLabel: 'Projects on this day', noProject: 'No project', hours: 'Hours', sessions: 'Sessions', minutes: 'Minutes', noData: 'No data for the selected period',
  };

  const actualProjects = useMemo(() => projects.filter((project) => !project.is_folder), [projects]);
  const availableTasks = useMemo(() => tasks.filter((task) => projectId === 'all' || task.project_id === projectId), [tasks, projectId]);

  const filteredSessions = useMemo(() => sessions.filter((session) => {
    if (dateRange.start && session.session_date < dateRange.start) return false;
    if (dateRange.end && session.session_date > dateRange.end) return false;
    if (projectId !== 'all' && session.project_id !== projectId) return false;
    if (taskId !== 'all' && session.task_id !== taskId) return false;
    if (sessionType === 'completed' && !session.end_time) return false;
    if (sessionType === 'running' && session.end_time) return false;
    return true;
  }), [sessions, dateRange, projectId, taskId, sessionType]);

  const chartData = useMemo(() => {
    const end = dateRange.end ? parseLocalDate(dateRange.end) : new Date();
    const start = dateRange.start ? parseLocalDate(dateRange.start) : new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
    const projectNameById = new Map(actualProjects.map((project) => [project.id, project.name]));
    const byDate = new Map<string, { minutes: number; sessions: number; plannedMinutes: number; plannedSessions: number; projects: Map<string, number> }>();
    filteredSessions.forEach((session) => {
      const current = byDate.get(session.session_date) || { minutes: 0, sessions: 0, plannedMinutes: 0, plannedSessions: 0, projects: new Map<string, number>() };
      current.minutes += session.duration;
      current.sessions += 1;
      const planned = sessionPlans[session.id] || 0;
      if (planned > 0) {
        current.plannedMinutes += planned;
        current.plannedSessions += 1;
      }
      const projectName = session.project_id ? String(projectNameById.get(session.project_id) || c.noProject) : c.noProject;
      current.projects.set(projectName, (current.projects.get(projectName) || 0) + session.duration);
      byDate.set(session.session_date, current);
    });
    const result = [];
    const cursor = new Date(start);
    while (cursor <= end && result.length < 3660) {
      const key = toLocalDateKey(cursor);
      const values = byDate.get(key) || { minutes: 0, sessions: 0, plannedMinutes: 0, plannedSessions: 0, projects: new Map<string, number>() };
      result.push({
        key,
        label: cursor.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { weekday: 'short' }),
        date: cursor.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { day: '2-digit', month: '2-digit' }),
        hours: Number((values.minutes / 60).toFixed(1)),
        sessions: values.sessions,
        average: values.sessions ? Math.round(values.minutes / values.sessions) : 0,
        plannedAverage: values.plannedSessions ? Math.round(values.plannedMinutes / values.plannedSessions) : 0,
        projectBreakdown: Array.from(values.projects.entries()).map(([name, minutes]) => ({ name, hours: Number((minutes / 60).toFixed(1)) })).sort((left, right) => right.hours - left.hours),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [actualProjects, c.noProject, dateRange, filteredSessions, isArabic, sessionPlans]);

  const projectComparison = useMemo(() => actualProjects.map((project) => ({
    name: project.name,
    actual: Number((filteredSessions.filter((session) => session.project_id === project.id).reduce((sum, session) => sum + session.duration, 0) / 60).toFixed(1)),
    planned: Number(((projectPlans[project.id] || 0) / 60).toFixed(1)),
  })).filter((item) => item.actual > 0 || item.planned > 0), [actualProjects, filteredSessions, projectPlans]);

  const exportCsv = () => {
    if (!chartData.length) return;
    const csv = `\uFEFFDate,Hours,Sessions,Average minutes\n${chartData.map((item) => `${item.key},${item.hours},${item.sessions},${item.average}`).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sabeel-charts-${toLocalDateKey()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const expandChart = () => chartCardRef.current?.requestFullscreen?.();
  const grid = darkMode ? '#334155' : '#e8edf4';
  const tick = darkMode ? '#94a3b8' : '#64748b';
  const tooltipStyle = { background: darkMode ? '#0f172a' : '#fff', border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: 12, color: darkMode ? '#f8fafc' : '#0f172a' };
  const controlClass = 'h-11 min-w-40 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 lg:max-w-56';

  const renderMainChart = () => {
    const common = <><CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: tick, fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: tick, fontSize: 11 }} unit="h" /><Tooltip content={(props) => <DailyTooltip {...props} mode="hours" copy={c} darkMode={darkMode} />} /></>;
    if (mainChart === 'bar') return <BarChart data={chartData}>{common}<Bar dataKey="hours" fill="#6f74da" radius={[10, 10, 0, 0]} maxBarSize={42} isAnimationActive={false} /></BarChart>;
    if (mainChart === 'line') return <LineChart data={chartData}>{common}<Line type="monotone" dataKey="hours" stroke="#626bd6" strokeWidth={2.5} dot={{ r: 4, fill: '#fff', stroke: '#626bd6', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#626bd6', stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} /></LineChart>;
    return <AreaChart data={chartData}>{common}<defs><linearGradient id="hoursGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8c91e8" stopOpacity={0.24} /><stop offset="100%" stopColor="#8c91e8" stopOpacity={0.015} /></linearGradient></defs><Area type="monotone" dataKey="hours" stroke="#626bd6" strokeWidth={2.5} fill="url(#hoursGradient)" dot={{ r: 4, fill: '#fff', stroke: '#626bd6', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#626bd6', stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} /></AreaChart>;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-4 pb-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><div className="flex items-center gap-3"><BarChart3 size={26} className="text-blue-600" /><h1 className="text-3xl font-black text-slate-900 dark:text-white">{c.title}</h1></div><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{c.subtitle}</p></div></header>

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <DateRangePicker value={dateRange} language={lang} onApply={setDateRange} />
        <select aria-label={c.allProjects} value={projectId} onChange={(event) => { setProjectId(event.target.value); setTaskId('all'); }} className={controlClass}><option value="all">{c.allProjects}</option>{actualProjects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select>
        <select aria-label={c.allTasks} value={taskId} onChange={(event) => setTaskId(event.target.value)} className={controlClass}><option value="all">{c.allTasks}</option>{availableTasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}</select>
        <select aria-label={c.allSessions} value={sessionType} onChange={(event) => setSessionType(event.target.value)} className={controlClass}><option value="all">{c.allSessions}</option><option value="completed">{c.completed}</option><option value="running">{c.running}</option></select>
        <button onClick={exportCsv} className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-600 dark:text-slate-200"><Download size={17} />{c.export}</button>
      </section>

      <nav className="grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"><button onClick={() => setActiveView('analytics')} className="h-13 text-sm font-bold text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">{c.overview}</button><button className="relative h-13 bg-blue-50 text-sm font-black text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">{c.charts}<span className="absolute inset-x-3 bottom-0 h-0.5 bg-blue-600" /></button><button onClick={() => setActiveView('analytics')} className="h-13 text-sm font-bold text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">{c.distribution}</button></nav>

      <section ref={chartCardRef} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><TrendingUp size={19} /></span><div><h2 className="text-xl font-black text-slate-900 dark:text-white">{c.dailyHours}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{c.dailyHoursHint}</p></div></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl border border-slate-200 bg-slate-50/70 p-1 dark:border-slate-600 dark:bg-slate-900">{([{ id: 'area', icon: AreaChartIcon }, { id: 'line', icon: LineChartIcon }, { id: 'bar', icon: BarChart3 }] as const).map(({ id, icon: Icon }) => <button key={id} type="button" onClick={() => setMainChart(id)} aria-pressed={mainChart === id} aria-label={id === 'area' ? (isArabic ? 'رسم مساحي' : 'Area chart') : id === 'line' ? (isArabic ? 'رسم خطي' : 'Line chart') : (isArabic ? 'أعمدة' : 'Bar chart')} className={`grid h-9 w-10 place-items-center rounded-lg transition ${mainChart === id ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-700 dark:text-indigo-300 dark:ring-slate-600' : 'text-slate-400 hover:bg-white hover:text-indigo-600 dark:hover:bg-slate-700'}`}><Icon size={17} /></button>)}</div><button onClick={exportCsv} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-300"><Download size={15} />{c.export}</button><button onClick={expandChart} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-300"><Expand size={15} />{c.expand}</button></div></div>
        <div className="h-[330px] w-full rounded-xl bg-slate-50/40 p-2 dark:bg-slate-900/30 sm:h-[350px]"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={100}>{renderMainChart()}</ResponsiveContainer></div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title={c.sessionsOverTime} hint={c.sessionsHint} legend={<ChartLegend items={[{ label: c.sessions, color: '#6257df' }]} />}><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={100}><BarChart data={chartData} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}><CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: tick, fontSize: 11 }} dy={9} /><YAxis axisLine={false} tickLine={false} tick={{ fill: tick, fontSize: 11 }} allowDecimals={false} width={32} /><Tooltip content={(props) => <DailyTooltip {...props} mode="sessions" copy={c} darkMode={darkMode} />} cursor={{ fill: darkMode ? '#334155' : '#f4f5fc' }} /><Bar name={c.sessions} dataKey="sessions" fill="#6257df" radius={[7, 7, 0, 0]} maxBarSize={42} isAnimationActive={false} /></BarChart></ResponsiveContainer></ChartCard>
        <ChartCard title={c.averageDuration} hint={c.averageHint} legend={<ChartLegend items={[{ label: c.actual, color: '#35b989' }, { label: c.planned, color: '#a6b4c8' }]} />}><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={100}><BarChart data={chartData} margin={{ top: 12, right: 4, left: 4, bottom: 0 }} barGap={4}><CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: tick, fontSize: 11 }} dy={9} /><YAxis axisLine={false} tickLine={false} tick={{ fill: tick, fontSize: 11 }} unit="m" width={40} /><Tooltip content={(props) => <DailyTooltip {...props} mode="average" copy={c} darkMode={darkMode} />} cursor={{ fill: darkMode ? '#334155' : '#f5f8fb' }} /><Bar name={c.planned} dataKey="plannedAverage" fill="#a6b4c8" radius={[6, 6, 0, 0]} maxBarSize={23} isAnimationActive={false} /><Bar name={c.actual} dataKey="average" fill="#35b989" radius={[6, 6, 0, 0]} maxBarSize={23} isAnimationActive={false} /></BarChart></ResponsiveContainer></ChartCard>
      </div>

      <ChartCard title={c.planComparison} hint={c.planComparisonHint} legend={<ChartLegend items={[{ label: c.planned, color: '#9daec3' }, { label: c.actual, color: '#8560df' }]} />} wide>
        {projectComparison.length ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={100}><BarChart data={projectComparison} margin={{ top: 12, right: 8, left: 8, bottom: 8 }} barGap={5}><CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: tick, fontSize: 11 }} interval={0} dy={10} tickFormatter={(name: string) => name.length > 22 ? `${name.slice(0, 21)}…` : name} /><YAxis axisLine={false} tickLine={false} tick={{ fill: tick, fontSize: 11 }} unit="h" width={38} /><Tooltip contentStyle={tooltipStyle} /><Bar name={c.planned} dataKey="planned" fill="#9daec3" radius={[6, 6, 0, 0]} maxBarSize={30} isAnimationActive={false} /><Bar name={c.actual} dataKey="actual" fill="#8560df" radius={[6, 6, 0, 0]} maxBarSize={30} isAnimationActive={false} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm font-semibold text-slate-400">{c.noData}</div>}
      </ChartCard>
    </motion.div>
  );
}

function DailyTooltip({ active, payload, mode, copy, darkMode }: { active?: boolean; payload?: ReadonlyArray<{ payload?: Record<string, unknown> }>; mode: 'hours' | 'average' | 'sessions'; copy: Record<string, string>; darkMode: boolean }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { date?: string; hours?: number; sessions?: number; average?: number; plannedAverage?: number; projectBreakdown?: Array<{ name: string; hours: number }> } | undefined;
  if (!row) return null;
  return <div className={`min-w-48 rounded-xl border p-3 shadow-xl ${darkMode ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`}>
    <p className="mb-2 text-xs font-black">{row.date}</p>
    {mode === 'hours' ? <p className="text-sm font-black text-blue-600 dark:text-blue-300">{copy.hours}: {row.hours || 0}h</p> : mode === 'sessions' ? <p className="text-sm font-black text-indigo-600 dark:text-indigo-300">{copy.sessions}: {row.sessions || 0}</p> : <div className="space-y-1 text-sm font-bold"><p><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> {copy.actual}: {row.average || 0}m</p><p><span className="inline-block h-2 w-2 rounded-sm bg-slate-400" /> {copy.planned}: {row.plannedAverage || 0}m</p></div>}
    {mode === 'hours' && !!row.projectBreakdown?.length && <div className={`mt-2 border-t pt-2 ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}><p className="mb-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">{copy.projectsLabel}</p>{row.projectBreakdown.map((project) => <div key={project.name} className="flex items-center justify-between gap-4 text-xs"><span className="max-w-40 truncate font-bold">{project.name}</span><span className="font-mono text-slate-500 dark:text-slate-300">{project.hours}h</span></div>)}</div>}
  </div>;
}

function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label={items.map((item) => item.label).join('، ')}>{items.map((item) => <span key={item.label} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />{item.label}</span>)}</div>;
}

function ChartCard({ title, hint, legend, wide = false, children }: { title: string; hint: string; legend: React.ReactNode; wide?: boolean; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6"><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><TrendingUp size={17} /></span><div className="min-w-0"><h2 className="text-lg font-black text-slate-900 dark:text-white">{title}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p></div></div>{legend}</div><div className={wide ? 'h-[330px] w-full' : 'h-[280px] w-full'}>{children}</div></section>;
}
