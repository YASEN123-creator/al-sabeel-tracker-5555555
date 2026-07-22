'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  CalendarDays,
  Clock3,
  Download,
  Filter,
  FolderKanban,
  TableProperties,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { useShallow } from '@/lib/useAppShallow';
import { parseLocalDate, toLocalDateKey } from '@/lib/localDate';
import DateRangePicker from '@/components/DateRangePicker';

const HEAT_COLORS = [
  'bg-slate-100 dark:bg-slate-800/80',
  'bg-violet-100 dark:bg-violet-950/80',
  'bg-violet-300 dark:bg-violet-800',
  'bg-violet-500 dark:bg-violet-600',
  'bg-violet-700 dark:bg-violet-400',
];

const STAT_TONES = {
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
};

function formatMinutes(minutes: number, lang: string) {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (!hours) return lang === 'ar' ? `${rest} د` : `${rest}m`;
  if (!rest) return lang === 'ar' ? `${hours} س` : `${hours}h`;
  return lang === 'ar' ? `${hours} س ${rest} د` : `${hours}h ${rest}m`;
}

export default function Analytics() {
  const { sessions, projects, tasks, settings, projectPlans } = useAppStore(useShallow((state) => ({
    sessions: state.sessions,
    projects: state.projects,
    tasks: state.tasks,
    settings: state.settings,
    projectPlans: state.projectPlans,
  })));
  const t = useT();
  const lang = useAppStore((state) => state.language || 'ar');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedTaskId, setSelectedTaskId] = useState('all');
  const [sessionType, setSessionType] = useState('all');
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
    return { start: toLocalDateKey(start), end: toLocalDateKey(today) };
  });

  const c = lang === 'ar' ? {
    title: 'توزيع الوقت حسب المشاريع', subtitle: 'تحليل شامل للوقت الذي تقضيه على كل مشروع',
    period: 'الفترة الزمنية', allProjects: 'كل المشاريع', allTasks: 'كل المهام', allSessions: 'كل الجلسات', completedSessions: 'الجلسات المكتملة', activeSessions: 'الجلسات الجارية', export: 'تصدير',
    totalTime: 'إجمالي الوقت', projectCount: 'عدد المشاريع', activeProjects: 'مشاريع نشطة',
    average: 'متوسط الوقت لكل مشروع', mostActive: 'أكثر مشروع', noProject: 'بدون مشروع',
    heatmap: 'الخريطة الحرارية للأيام', heatmapDesc: 'كلما زادت كثافة اللون، زاد الوقت المسجل في ذلك اليوم',
    less: 'وقت أقل', more: 'وقت أكثر', projectDetails: 'تفاصيل المشاريع',
    projectDetailsDesc: 'تحليل تفصيلي للأداء والوقت لكل مشروع خلال الفترة المحددة', project: 'المشروع',
    color: 'اللون', actual: 'الوقت الفعلي', planned: 'الوقت المخطط', completion: 'نسبة الإنجاز',
    sessions: 'الجلسات', averageSession: 'متوسط الجلسة', lastSession: 'آخر جلسة', progress: 'التقدم', status: 'الحالة',
    notSet: 'غير محدد', completed: 'مكتمل', active: 'نشط', notStarted: 'لم يبدأ', noData: 'لا توجد بيانات في هذه الفترة',
    dayNames: ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'],
  } : {
    title: 'Time Distribution by Project', subtitle: 'A complete analysis of time spent on every project',
    period: 'Time period', allProjects: 'All projects', allTasks: 'All tasks', allSessions: 'All sessions', completedSessions: 'Completed sessions', activeSessions: 'Running sessions', export: 'Export',
    totalTime: 'Total time', projectCount: 'Projects', activeProjects: 'active projects',
    average: 'Average per project', mostActive: 'Most active project', noProject: 'No project',
    heatmap: 'Daily activity heatmap', heatmapDesc: 'Darker cells represent more recorded time on that day',
    less: 'Less time', more: 'More time', projectDetails: 'Project Details',
    projectDetailsDesc: 'Detailed project performance and time for the selected period', project: 'Project',
    color: 'Color', actual: 'Actual time', planned: 'Planned time', completion: 'Completion',
    sessions: 'Sessions', averageSession: 'Avg. session', lastSession: 'Last session', progress: 'Progress', status: 'Status',
    notSet: 'Not set', completed: 'Completed', active: 'Active', notStarted: 'Not started', noData: 'No data in this period',
    dayNames: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  };

  const actualProjects = useMemo(() => projects.filter((project) => !project.is_folder), [projects]);
  const availableTasks = useMemo(() => tasks.filter((task) => selectedProjectId === 'all' || task.project_id === selectedProjectId), [tasks, selectedProjectId]);

  const rangeDates = useMemo(() => {
    const fallbackEnd = new Date();
    const fallbackStart = new Date(fallbackEnd.getFullYear(), fallbackEnd.getMonth(), fallbackEnd.getDate() - 29);
    const start = dateRange.start ? parseLocalDate(dateRange.start) : sessions.length
      ? parseLocalDate([...sessions].sort((a, b) => a.session_date.localeCompare(b.session_date))[0].session_date)
      : fallbackStart;
    const end = dateRange.end ? parseLocalDate(dateRange.end) : fallbackEnd;
    const dates: Array<{ date: Date; key: string }> = [];
    const cursor = new Date(start);
    while (cursor <= end && dates.length < 3660) {
      dates.push({ date: new Date(cursor), key: toLocalDateKey(cursor) });
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [dateRange, sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (dateRange.start && session.session_date < dateRange.start) return false;
      if (dateRange.end && session.session_date > dateRange.end) return false;
      if (selectedProjectId !== 'all' && session.project_id !== selectedProjectId) return false;
      if (selectedTaskId !== 'all' && session.task_id !== selectedTaskId) return false;
      if (sessionType === 'completed' && !session.end_time) return false;
      if (sessionType === 'active' && session.end_time) return false;
      return true;
    });
  }, [sessions, dateRange, selectedProjectId, selectedTaskId, sessionType]);

  const totalMinutes = filteredSessions.reduce((sum, session) => sum + session.duration, 0);
  const activeProjectIds = new Set(filteredSessions.map((session) => session.project_id).filter(Boolean));
  const visibleProjects = selectedProjectId !== 'all'
    ? actualProjects.filter((project) => project.id === selectedProjectId)
    : actualProjects;

  const projectRows = useMemo(() => visibleProjects.map((project) => {
    const projectSessions = filteredSessions.filter((session) => session.project_id === project.id);
    const projectTasks = tasks.filter((task) => task.project_id === project.id);
    const minutes = projectSessions.reduce((sum, session) => sum + session.duration, 0);
    const completedTasks = projectTasks.filter((task) => task.is_completed).length;
    const completion = projectTasks.length ? Math.round((completedTasks / projectTasks.length) * 100) : 0;
    const last = [...projectSessions].sort((a, b) => b.start_time.localeCompare(a.start_time))[0];
    return {
      project,
      minutes,
      count: projectSessions.length,
      average: projectSessions.length ? Math.round(minutes / projectSessions.length) : 0,
      completion,
      last,
    };
  }).sort((a, b) => b.minutes - a.minutes), [visibleProjects, filteredSessions, tasks]);

  const topProject = projectRows[0];

  const heatmap = useMemo(() => {
    const minutesByDate = new Map<string, number>();
    filteredSessions.forEach((session) => minutesByDate.set(
      session.session_date,
      (minutesByDate.get(session.session_date) || 0) + session.duration,
    ));
    const weekStart = lang === 'ar' ? 6 : 0;
    const firstDay = ((rangeDates[0]?.date.getDay() ?? weekStart) - weekStart + 7) % 7;
    const padded: Array<{ date: Date; key: string } | null> = [
      ...Array.from({ length: firstDay }, () => null),
      ...rangeDates,
    ];
    while (padded.length % 7) padded.push(null);
    const weeks = Array.from({ length: padded.length / 7 }, (_, index) => padded.slice(index * 7, index * 7 + 7));
    return { minutesByDate, weeks, max: Math.max(1, ...minutesByDate.values()) };
  }, [filteredSessions, rangeDates, lang]);

  if (settings?.enable_analytics === false) {
    return <div className="flex min-h-[60vh] flex-col items-center justify-center"><Activity size={48} className="mb-4 text-slate-300 dark:text-slate-600" /><h2 className="font-bold text-slate-400">{t('analytics.disabled')}</h2></div>;
  }

  const exportSessions = () => {
    if (filteredSessions.length === 0) return;
    const quote = (value: string | number | null) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = filteredSessions.map((session) => [
      session.session_date,
      actualProjects.find((project) => project.id === session.project_id)?.name || c.noProject,
      tasks.find((task) => task.id === session.task_id)?.title || '',
      session.start_time,
      session.end_time || '',
      session.duration,
    ].map(quote).join(','));
    const csv = `\uFEFF${['Date', 'Project', 'Task', 'Start', 'End', 'Duration (minutes)'].map(quote).join(',')}\n${rows.join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sabeel-analytics-${toLocalDateKey()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-4 pb-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{c.title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{c.subtitle}</p>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <label className="relative min-w-44 flex-1 lg:max-w-60"><Filter size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" /><select aria-label={c.allProjects} value={selectedProjectId} onChange={(event) => { setSelectedProjectId(event.target.value); setSelectedTaskId('all'); }} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pe-9 ps-10 text-sm font-bold text-slate-700 outline-none transition hover:border-violet-300 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"><option value="all">{c.allProjects}</option>{actualProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label className="min-w-44 flex-1 lg:max-w-60"><select aria-label={c.allTasks} value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition hover:border-violet-300 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"><option value="all">{c.allTasks}</option>{availableTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
        <label className="min-w-44 flex-1 lg:max-w-60"><select aria-label={c.allSessions} value={sessionType} onChange={(event) => setSessionType(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition hover:border-violet-300 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"><option value="all">{c.allSessions}</option><option value="completed">{c.completedSessions}</option><option value="active">{c.activeSessions}</option></select></label>
        <div className="min-w-64 flex-1 lg:max-w-80"><DateRangePicker value={dateRange} language={lang} onApply={setDateRange} /></div>
        <button type="button" onClick={exportSessions} disabled={filteredSessions.length === 0} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-violet-300"><Download size={17} />{c.export}</button>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Clock3, label: c.totalTime, value: formatMinutes(totalMinutes, lang), note: '100%', tone: 'violet' },
          { icon: Target, label: c.projectCount, value: String(activeProjectIds.size), note: c.activeProjects, tone: 'emerald' },
          { icon: TrendingUp, label: c.average, value: formatMinutes(activeProjectIds.size ? Math.round(totalMinutes / activeProjectIds.size) : 0, lang), note: c.activeProjects, tone: 'amber' },
          { icon: FolderKanban, label: c.mostActive, value: topProject?.project.name || '—', note: topProject ? formatMinutes(topProject.minutes, lang) : c.noData, tone: 'blue' },
        ].map(({ icon: Icon, label, value, note, tone }) => <article key={label} className="flex min-h-28 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${STAT_TONES[tone as keyof typeof STAT_TONES]}`}><Icon size={26} /></div><div className="min-w-0"><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 truncate text-xl font-black text-slate-900 dark:text-white">{value}</p><p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{note}</p></div></article>)}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><div className="flex items-center gap-2"><CalendarDays size={20} className="text-violet-600 dark:text-violet-400" /><h2 className="text-lg font-black text-slate-900 dark:text-white">{c.heatmap}</h2></div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{c.heatmapDesc}</p></div>
          <span className="rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">{rangeDates.length} {lang === 'ar' ? 'يوم' : 'days'}</span>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-[720px] gap-3">
            <div className="grid w-7 shrink-0 grid-rows-7 gap-2 pt-7 text-center text-xs font-bold text-slate-400">{c.dayNames.map((day, index) => <span key={`${day}-${index}`} className="flex items-center justify-center">{day}</span>)}</div>
            <div className="grid min-h-[290px] flex-1 grid-flow-col auto-cols-[minmax(18px,1fr)] grid-rows-[28px_repeat(7,minmax(28px,1fr))] gap-2">
              {heatmap.weeks.map((week, weekIndex) => {
                const labelDate = week.find(Boolean)?.date;
                return <div key={`week-${weekIndex}`} className="contents"><span className="flex items-center justify-center whitespace-nowrap text-[10px] font-bold text-slate-400">{labelDate && (weekIndex === 0 || labelDate.getDate() <= 7) ? labelDate.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short' }) : ''}</span>{week.map((day, dayIndex) => {
                  if (!day) return <span key={`empty-${weekIndex}-${dayIndex}`} />;
                  const minutes = heatmap.minutesByDate.get(day.key) || 0;
                  const level = minutes === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((minutes / heatmap.max) * 4)));
                  return <span key={day.key} title={`${day.date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}: ${formatMinutes(minutes, lang)}`} className={`group relative min-h-8 rounded-md border border-white/70 transition duration-200 hover:z-10 hover:scale-110 hover:ring-2 hover:ring-violet-400 dark:border-slate-900 ${HEAT_COLORS[level]}`}><span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white shadow-xl group-hover:block">{formatMinutes(minutes, lang)}</span></span>;
                })}</div>;
              })}
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-center gap-3 text-xs font-semibold text-slate-400"><span>{c.less}</span><div className="flex gap-1">{HEAT_COLORS.map((color, index) => <i key={color} className={`h-3.5 w-8 rounded ${color}`} aria-label={`${index}`} />)}</div><span>{c.more}</span></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start gap-3 border-b border-slate-100 p-5 dark:border-slate-700"><TableProperties size={21} className="mt-0.5 text-violet-600 dark:text-violet-400" /><div><h2 className="text-lg font-black text-slate-900 dark:text-white">{c.projectDetails}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{c.projectDetailsDesc}</p></div></div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[940px] table-fixed text-start">
            <colgroup><col className="w-[17%]" /><col className="w-[7%]" /><col className="w-[9%]" /><col className="w-[9%]" /><col className="w-[9%]" /><col className="w-[6%]" /><col className="w-[10%]" /><col className="w-[11%]" /><col className="w-[14%]" /><col className="w-[8%]" /></colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50/95 text-xs font-bold text-slate-500 backdrop-blur dark:bg-slate-950/95 dark:text-slate-300"><tr><th className="px-5 py-4 text-start">{c.project}</th><th className="px-4 py-4 text-start">{c.color}</th><th className="px-4 py-4 text-start">{c.actual}</th><th className="px-4 py-4 text-start">{c.planned}</th><th className="px-4 py-4 text-start">{c.completion}</th><th className="px-4 py-4 text-start">{c.sessions}</th><th className="px-4 py-4 text-start">{c.averageSession}</th><th className="px-4 py-4 text-start">{c.lastSession}</th><th className="min-w-44 px-4 py-4 text-start">{c.progress}</th><th className="px-4 py-4 text-start">{c.status}</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">{projectRows.length === 0 ? <tr><td colSpan={10} className="px-5 py-16 text-center text-sm text-slate-400">{c.noData}</td></tr> : projectRows.map(({ project, minutes, count, average, completion, last }) => {
              const status = completion === 100 ? c.completed : count > 0 || completion > 0 ? c.active : c.notStarted;
              const statusClass = completion === 100 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : count > 0 || completion > 0 ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300';
              return <tr key={project.id} className="transition hover:bg-violet-50/40 dark:hover:bg-violet-500/5"><td className="px-5 py-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><FolderKanban size={19} /></span><div><p className="font-bold text-slate-900 dark:text-white">{project.name}</p><p className="mt-0.5 max-w-52 truncate text-xs text-slate-400">{project.description || c.noData}</p></div></div></td><td className="px-4 py-5"><span className="flex items-center gap-2 text-xs font-semibold text-slate-500"><i className="h-3.5 w-3.5 rounded-full ring-4 ring-slate-100 dark:ring-slate-700" style={{ backgroundColor: project.color || '#94a3b8' }} />{project.color || '—'}</span></td><td className="px-4 py-5 font-extrabold text-slate-800 dark:text-slate-100">{formatMinutes(minutes, lang)}</td><td className="px-4 py-5"><span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200" title={projectPlans[project.id] ? c.planned : c.notSet}>{projectPlans[project.id] ? formatMinutes(projectPlans[project.id], lang) : '—'}</span></td><td className="px-4 py-5"><span className="inline-flex h-10 w-10 items-center justify-center rounded-full border-4 border-violet-100 text-xs font-black text-violet-700 dark:border-violet-900 dark:text-violet-300">{completion}%</span></td><td className="px-4 py-5 font-bold text-slate-700 dark:text-slate-200">{count}</td><td className="px-4 py-5 text-sm font-semibold text-slate-600 dark:text-slate-300">{formatMinutes(average, lang)}</td><td className="px-4 py-5 text-sm text-slate-600 dark:text-slate-300">{last ? parseLocalDate(last.session_date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td><td className="px-4 py-5"><div className="flex items-center gap-3"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500 transition-all" style={{ width: `${completion}%` }} /></div><b className="w-9 text-xs text-slate-600 dark:text-slate-300">{completion}%</b></div></td><td className="px-4 py-5"><span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${statusClass}`}><i className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span></td></tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    </motion.div>
  );
}
