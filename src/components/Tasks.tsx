'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Edit3,
  FolderKanban,
  ListChecks,
  ListTodo,
  MoreHorizontal,
  PlayCircle,
  Plus,
  Repeat2,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import DateRangePicker from '@/components/DateRangePicker';
import { SkeletonList } from '@/components/Skeleton';
import { createTask, deleteTask, updateTask } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { parseLocalDate } from '@/lib/localDate';
import { useAppStore } from '@/lib/store';
import type { Project, Task } from '@/lib/types';
import { useShallow } from '@/lib/useAppShallow';

const DAY_KEYS_AR = [6, 0, 1, 2, 3, 4, 5];
const DAY_KEYS_EN = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABEL_KEYS = [
  'tasks.daySun',
  'tasks.dayMon',
  'tasks.dayTue',
  'tasks.dayWed',
  'tasks.dayThu',
  'tasks.dayFri',
  'tasks.daySat',
];
const PAGE_SIZE = 10;

type DateRange = { start: string | null; end: string | null };

const copy = {
  ar: {
    total: 'إجمالي المهام', completed: 'مكتملة', active: 'قيد التنفيذ', recurring: 'متكررة', scheduled: 'مجدولة',
    allStatuses: 'جميع الحالات', allProjects: 'جميع المشاريع', allTypes: 'كل الأنواع', oneTime: 'مرة واحدة',
    type: 'النوع', task: 'المهمة', project: 'المشروع', status: 'الحالة', tracked: 'الوقت المستغرق',
    created: 'تاريخ الإنشاء', due: 'الموعد النهائي', actions: 'الإجراءات', noProject: 'بدون مشروع',
    edit: 'تعديل المهمة', remove: 'حذف المهمة', menu: 'إجراءات المهمة', complete: 'تحديد كمكتملة', reopen: 'إعادة فتح المهمة',
    showing: 'عرض', of: 'من', taskUnit: 'مهمة', previous: 'السابق', next: 'التالي',
    sort: 'ترتيب المهام', scheduledHint: 'لها موعد نهائي', recurringHint: 'تتكرر تلقائياً', createFirst: 'إضافة مهمة جديدة',
    noDue: 'غير محدد', noTime: '0 د', filterType: 'تصفية حسب النوع', filterStatus: 'تصفية حسب الحالة',
    filterProject: 'تصفية حسب المشروع', percent: 'من إجمالي المهام', close: 'إغلاق النافذة',
  },
  en: {
    total: 'Total tasks', completed: 'Completed', active: 'In progress', recurring: 'Recurring', scheduled: 'Scheduled',
    allStatuses: 'All statuses', allProjects: 'All projects', allTypes: 'All types', oneTime: 'One-time',
    type: 'Type', task: 'Task', project: 'Project', status: 'Status', tracked: 'Time spent',
    created: 'Created date', due: 'Due date', actions: 'Actions', noProject: 'No project',
    edit: 'Edit task', remove: 'Delete task', menu: 'Task actions', complete: 'Mark completed', reopen: 'Reopen task',
    showing: 'Showing', of: 'of', taskUnit: 'tasks', previous: 'Previous', next: 'Next',
    sort: 'Sort tasks', scheduledHint: 'Has a due date', recurringHint: 'Repeats automatically', createFirst: 'Add a new task',
    noDue: 'Not set', noTime: '0m', filterType: 'Filter by type', filterStatus: 'Filter by status',
    filterProject: 'Filter by project', percent: 'of all tasks', close: 'Close dialog',
  },
};

function formatMinutes(minutes: number, language: 'ar' | 'en') {
  if (minutes <= 0) return language === 'ar' ? '0 د' : '0m';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return language === 'ar' ? `${remainder} د` : `${remainder}m`;
  if (!remainder) return language === 'ar' ? `${hours} س` : `${hours}h`;
  return language === 'ar' ? `${hours} س ${remainder} د` : `${hours}h ${remainder}m`;
}

function formatDate(value: string | null, language: 'ar' | 'en', localDate = false) {
  if (!value) return null;
  const date = localDate ? parseLocalDate(value) : new Date(value);
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date);
}

export default function Tasks() {
  const t = useT();
  const storedLanguage = useAppStore((state) => state.language || 'ar');
  const language: 'ar' | 'en' = storedLanguage === 'en' ? 'en' : 'ar';
  const c = copy[language];
  const { tasks, projects, sessions, addTask, updateTask: updateTaskInStore, removeTask, dataLoading, addToast } = useAppStore(useShallow((state) => ({
    tasks: state.tasks,
    projects: state.projects,
    sessions: state.sessions,
    addTask: state.addTask,
    updateTask: state.updateTask,
    removeTask: state.removeTask,
    dataLoading: state.dataLoading,
    addToast: state.addToast,
  })));

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [filterProject, setFilterProject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState('');
  const pendingCreate = useAppStore((state) => state.pendingCreate);
  const setPendingCreate = useAppStore((state) => state.setPendingCreate);

  const resetForm = () => {
    setTitle(''); setDescription(''); setProjectId(null); setDueDate(''); setIsRecurring(false);
    setRecurringDays([]); setEditingTask(null); setError('');
  };
  const openCreate = () => { resetForm(); setShowModal(true); };
  const openEdit = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setProjectId(task.project_id);
    setDueDate(task.due_date || '');
    setIsRecurring(task.is_recurring || false);
    setRecurringDays(task.recurring_days || []);
    setShowModal(true);
  };

  useEffect(() => {
    if (pendingCreate !== 'task') return;
    const frame = requestAnimationFrame(() => {
      resetForm(); setShowModal(true); setPendingCreate(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingCreate, setPendingCreate]);

  const toggleDay = (day: number) => setRecurringDays((previous) => previous.includes(day)
    ? previous.filter((item) => item !== day)
    : [...previous, day].sort());
  const selectAllDays = () => setRecurringDays([0, 1, 2, 3, 4, 5, 6]);
  const dayOrder = language === 'ar' ? DAY_KEYS_AR : DAY_KEYS_EN;
  const getDaysLabel = (days: number[] | null) => {
    if (!days?.length) return null;
    if (days.length === 7) return t('tasks.everyDay');
    return days.map((day) => t(DAY_LABEL_KEYS[day])).join(' · ');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) { setError(t('tasks.titleRequired')); return; }
    try {
      const taskData = {
        title: title.trim(), description: description.trim() || null, project_id: projectId,
        due_date: dueDate || null, is_recurring: isRecurring,
        recurring_days: isRecurring ? (recurringDays.length ? recurringDays : null) : null,
      };
      if (editingTask) {
        const updated = await updateTask(editingTask.id, useAppStore.getState().userId || '', taskData);
        updateTaskInStore(updated);
      } else {
        const task = await createTask(useAppStore.getState().userId || '', taskData);
        addTask(task);
      }
      setShowModal(false);
      resetForm();
      addToast(editingTask ? t('toast.saved') : t('toast.success'), 'success');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(`${language === 'ar' ? 'خطأ' : 'Error'}: ${message}`);
      addToast(t('toast.error'), 'error');
    }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      const updated = await updateTask(task.id, useAppStore.getState().userId || '', { is_completed: !task.is_completed });
      updateTaskInStore(updated);
    } catch { addToast(t('toast.error'), 'error'); }
  };

  const handleDelete = (id: string) => {
    if (!confirm(t('tasks.deleteConfirm'))) return;
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const userId = useAppStore.getState().userId || '';
    removeTask(id);
    let undone = false;
    const timeout = window.setTimeout(async () => {
      if (undone) return;
      try { await deleteTask(id, userId); }
      catch {
        if (useAppStore.getState().userId === userId) {
          useAppStore.getState().addTask(task);
          addToast(t('toast.error'), 'error');
        }
      }
    }, 6000);
    addToast(t('toast.deleted'), 'info', {
      actionLabel: language === 'ar' ? 'تراجع' : 'Undo', duration: 6000,
      onAction: () => { undone = true; window.clearTimeout(timeout); addTask(task); },
    });
  };

  const projectById = useMemo(() => new Map<string, Project>(projects.map((project) => [project.id, project])), [projects]);
  const trackedMinutesByTask = useMemo(() => {
    const totals = new Map<string, number>();
    sessions.forEach((session) => {
      if (session.task_id) totals.set(session.task_id, (totals.get(session.task_id) || 0) + session.duration);
    });
    return totals;
  }, [sessions]);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (filterProject !== 'all' && task.project_id !== filterProject) return false;
    if (filterStatus === 'active' && task.is_completed) return false;
    if (filterStatus === 'completed' && !task.is_completed) return false;
    if (filterType === 'recurring' && !task.is_recurring) return false;
    if (filterType === 'oneTime' && task.is_recurring) return false;
    if (dateRange.start && (!task.due_date || task.due_date < dateRange.start)) return false;
    if (dateRange.end && (!task.due_date || task.due_date > dateRange.end)) return false;
    if (searchQuery) {
      const projectName = task.project_id ? projectById.get(task.project_id)?.name || '' : '';
      const haystack = `${task.title} ${task.description || ''} ${projectName}`.toLocaleLowerCase();
      if (!haystack.includes(searchQuery.trim().toLocaleLowerCase())) return false;
    }
    return true;
  }).sort((left, right) => {
    switch (sortBy) {
      case 'oldest': return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      case 'dueDate': {
        if (!left.due_date && !right.due_date) return 0;
        if (!left.due_date) return 1;
        if (!right.due_date) return -1;
        return parseLocalDate(left.due_date).getTime() - parseLocalDate(right.due_date).getTime();
      }
      case 'name': return left.title.localeCompare(right.title, language);
      default: return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    }
  }), [tasks, filterProject, filterStatus, filterType, dateRange, searchQuery, projectById, sortBy, language]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const visibleTasks = filteredTasks.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const firstVisible = filteredTasks.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const lastVisible = Math.min(safePage * PAGE_SIZE, filteredTasks.length);
  const percentage = (value: number) => tasks.length ? Math.round((value / tasks.length) * 100) : 0;
  const stats = [
    { label: c.total, value: tasks.length, detail: language === 'ar' ? 'كل المهام' : 'All tasks', icon: ListTodo, tone: 'blue' },
    { label: c.completed, value: tasks.filter((task) => task.is_completed).length, icon: CheckCircle2, tone: 'emerald' },
    { label: c.active, value: tasks.filter((task) => !task.is_completed).length, icon: PlayCircle, tone: 'indigo' },
    { label: c.recurring, value: tasks.filter((task) => task.is_recurring).length, icon: Repeat2, tone: 'amber' },
    { label: c.scheduled, value: tasks.filter((task) => Boolean(task.due_date)).length, icon: CalendarClock, tone: 'rose' },
  ];

  const selectClass = 'h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600';

  const taskIdentity = (task: Task, mobile = false) => (
    <div className="flex min-w-0 items-start gap-3">
      <button
        type="button"
        onClick={() => handleToggleComplete(task)}
        aria-label={task.is_completed ? c.reopen : c.complete}
        className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 outline-none transition hover:bg-slate-100 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800"
      >
        {task.is_completed ? <CheckCircle2 size={21} className="text-emerald-500" /> : <Circle size={21} />}
      </button>
      <div className="min-w-0">
        <p className={`truncate text-sm font-bold ${task.is_completed ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>{task.title}</p>
        {task.description && <p className={`mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400 ${mobile ? 'line-clamp-2' : 'max-w-[300px] truncate'}`}>{task.description}</p>}
        {task.is_recurring && <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-300"><Repeat2 size={12} />{getDaysLabel(task.recurring_days) || t('tasks.recurring')}</span>}
      </div>
    </div>
  );

  const typeBadge = (task: Task) => task.is_recurring
    ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><Repeat2 size={13} />{c.recurring}</span>
    : <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Check size={13} />{c.oneTime}</span>;

  const statusBadge = (task: Task) => task.is_completed
    ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 size={13} />{c.completed}</span>
    : <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"><PlayCircle size={13} />{c.active}</span>;

  return (
    <section className="sabeel-page-enter mx-auto w-full max-w-[1680px]">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="ps-14 md:ps-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{t('tasks.title')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('tasks.subtitle')}</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl bg-slate-900 px-5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)] outline-none transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:ring-4 focus-visible:ring-blue-500/25 dark:bg-blue-600 dark:hover:bg-blue-500 sm:self-auto">
          <Plus size={18} />{t('tasks.newTask')}
        </button>
      </header>

      <div className="mb-5 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-[0_3px_14px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950/50">
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_170px_170px_180px_210px_170px]">
          <label className="relative block">
            <span className="sr-only">{t('tasks.search')}</span>
            <Search size={17} className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }} placeholder={t('tasks.search')} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pe-10 ps-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500" />
          </label>
          <select aria-label={c.filterStatus} value={filterStatus} onChange={(event) => { setFilterStatus(event.target.value); setCurrentPage(1); }} className={selectClass}>
            <option value="all">{c.allStatuses}</option><option value="active">{c.active}</option><option value="completed">{c.completed}</option>
          </select>
          <select aria-label={c.filterType} value={filterType} onChange={(event) => { setFilterType(event.target.value); setCurrentPage(1); }} className={selectClass}>
            <option value="all">{c.allTypes}</option><option value="oneTime">{c.oneTime}</option><option value="recurring">{c.recurring}</option>
          </select>
          <select aria-label={c.filterProject} value={filterProject} onChange={(event) => { setFilterProject(event.target.value); setCurrentPage(1); }} className={selectClass}>
            <option value="all">{c.allProjects}</option>
            {projects.filter((project) => !project.is_folder).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <DateRangePicker value={dateRange} language={language} onApply={(range) => { setDateRange(range); setCurrentPage(1); }} />
          <label className="relative">
            <ArrowDownUp size={15} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select aria-label={c.sort} value={sortBy} onChange={(event) => { setSortBy(event.target.value); setCurrentPage(1); }} className={`${selectClass} w-full pe-9`}>
              <option value="newest">{t('tasks.sortNewest')}</option><option value="oldest">{t('tasks.sortOldest')}</option><option value="dueDate">{t('tasks.sortDueDate')}</option><option value="name">{t('tasks.sortName')}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const tone = {
            blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300', emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
            indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300', amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
            rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
          }[stat.tone];
          return <article key={stat.label} className="flex min-h-[118px] items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_3px_14px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
            <div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{stat.label}</p><p className="mt-1.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">{stat.value}</p><p className="mt-1 text-[11px] font-medium text-slate-400">{stat.detail || `${percentage(stat.value)}% ${c.percent}`}</p></div>
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${tone}`}><Icon size={22} strokeWidth={1.9} /></span>
          </article>;
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
        {dataLoading ? <div className="p-5"><SkeletonList /></div> : filteredTasks.length === 0 ? (
          <div className="grid min-h-[340px] place-items-center px-6 py-12 text-center">
            <div><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><ListChecks size={30} /></span><h2 className="mt-5 text-lg font-bold text-slate-800 dark:text-slate-100">{t('tasks.noTasks')}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('tasks.noTasksHint')}</p><button type="button" onClick={openCreate} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25 dark:bg-blue-600"><Plus size={17} />{c.createFirst}</button></div>
          </div>
        ) : <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1120px] table-fixed text-start">
              <thead className="bg-slate-50/90 text-xs font-bold text-slate-600 dark:bg-slate-950/70 dark:text-slate-300"><tr>
                <th className="w-[29%] px-5 py-4 text-start">{c.task}</th><th className="w-[14%] px-4 py-4 text-start">{c.project}</th><th className="w-[11%] px-4 py-4 text-start">{c.type}</th><th className="w-[11%] px-4 py-4 text-start">{c.status}</th><th className="w-[11%] px-4 py-4 text-start">{c.tracked}</th><th className="w-[10%] px-4 py-4 text-start">{c.created}</th><th className="w-[10%] px-4 py-4 text-start">{c.due}</th><th className="w-[4%] px-3 py-4 text-center">{c.actions}</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleTasks.map((task) => {
                  const project = task.project_id ? projectById.get(task.project_id) : null;
                  return <tr key={task.id} className="group transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/45">
                    <td className="px-5 py-3.5">{taskIdentity(task)}</td>
                    <td className="px-4 py-3.5"><span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{project ? <><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color || '#64748b' }} /> <span className="truncate">{project.name}</span></> : <><FolderKanban size={15} className="text-slate-400" />{c.noProject}</>}</span></td>
                    <td className="px-4 py-3.5">{typeBadge(task)}</td><td className="px-4 py-3.5">{statusBadge(task)}</td>
                    <td className="px-4 py-3.5"><span className="inline-flex items-center gap-1.5 text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200"><Clock3 size={15} className="text-slate-400" />{formatMinutes(trackedMinutesByTask.get(task.id) || 0, language)}</span></td>
                    <td className="px-4 py-3.5 text-sm tabular-nums text-slate-500 dark:text-slate-400">{formatDate(task.created_at, language)}</td>
                    <td className="px-4 py-3.5"><span className={`inline-flex items-center gap-1.5 text-sm tabular-nums ${task.due_date ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}><CalendarDays size={15} />{formatDate(task.due_date, language, true) || c.noDue}</span></td>
                    <td className="px-3 py-3.5 text-center"><details className="relative inline-block"><summary aria-label={c.menu} className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-white"><MoreHorizontal size={19} /></summary><div className="absolute end-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-start shadow-xl dark:border-slate-700 dark:bg-slate-800"><button type="button" onClick={() => openEdit(task)} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-200 dark:hover:bg-slate-700"><Edit3 size={15} />{c.edit}</button><button type="button" onClick={() => handleDelete(task.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-xs font-semibold text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-500/10"><Trash2 size={15} />{c.remove}</button></div></details></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 lg:hidden">
            {visibleTasks.map((task) => {
              const project = task.project_id ? projectById.get(task.project_id) : null;
              return <article key={task.id} className="p-4">
                {taskIdentity(task, true)}
                <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60"><p className="mb-1 text-slate-400">{c.project}</p><p className="truncate font-bold text-slate-700 dark:text-slate-200">{project?.name || c.noProject}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60"><p className="mb-1 text-slate-400">{c.tracked}</p><p className="font-bold text-slate-700 dark:text-slate-200">{formatMinutes(trackedMinutesByTask.get(task.id) || 0, language)}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60"><p className="mb-1 text-slate-400">{c.due}</p><p className="font-bold text-slate-700 dark:text-slate-200">{formatDate(task.due_date, language, true) || c.noDue}</p></div>
                  <div className="flex items-center justify-start gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">{statusBadge(task)}</div>
                </div>
                <div className="mt-3 flex items-center gap-2"><button type="button" onClick={() => openEdit(task)} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Edit3 size={16} />{c.edit}</button><button type="button" onClick={() => handleDelete(task.id)} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 text-sm font-bold text-red-600 outline-none transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-500/10"><Trash2 size={16} />{c.remove}</button></div>
              </article>;
            })}
          </div>

          <footer className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3.5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>{c.showing} <b className="text-slate-800 dark:text-slate-200">{firstVisible}–{lastVisible}</b> {c.of} <b className="text-slate-800 dark:text-slate-200">{filteredTasks.length}</b> {c.taskUnit}</p>
            <nav aria-label={language === 'ar' ? 'ترقيم صفحات المهام' : 'Task pagination'} className="flex items-center gap-1.5">
              <button type="button" disabled={safePage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} aria-label={c.previous} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{language === 'ar' ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, safePage - 3), Math.min(totalPages, safePage + 2)).map((page) => <button type="button" key={page} onClick={() => setCurrentPage(page)} aria-current={page === safePage ? 'page' : undefined} className={`h-10 min-w-10 rounded-xl px-2 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 ${page === safePage ? 'bg-slate-900 text-white shadow-sm dark:bg-blue-600' : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{page}</button>)}
              <button type="button" disabled={safePage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} aria-label={c.next} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{language === 'ar' ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}</button>
            </nav>
          </footer>
        </>}
      </div>

      {showModal && <div className="global-modal-overlay overflow-y-auto" onClick={() => setShowModal(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="task-dialog-title" onClick={(event) => event.stopPropagation()} className="global-modal-panel my-6 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800"><div><h2 id="task-dialog-title" className="text-xl font-extrabold text-slate-900 dark:text-white">{editingTask ? t('tasks.editTask') : t('tasks.newTask')}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('tasks.subtitle')}</p></div><button type="button" onClick={() => setShowModal(false)} aria-label={c.close} className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 outline-none transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-white"><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{t('tasks.titleField')}</span><input autoFocus value={title} onChange={(event) => { setTitle(event.target.value); setError(''); }} placeholder={t('tasks.titleField')} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />{error && <p role="alert" className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}</label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{t('tasks.description')}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" /></label>
              <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{t('tasks.project')}</span><select value={projectId || ''} onChange={(event) => setProjectId(event.target.value || null)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"><option value="">{t('tasks.noProject')}</option>{projects.filter((project) => !project.is_folder).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">{t('tasks.dueDate')}</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" /></label></div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={isRecurring} onChange={(event) => setIsRecurring(event.target.checked)} className="mt-0.5 h-5 w-5 rounded border-slate-300 accent-blue-600" /><span><b className="block text-sm text-slate-700 dark:text-slate-200">{t('tasks.recurring')}</b><small className="mt-1 block text-xs text-slate-400">{t('tasks.recurringDesc')}</small></span></label>
                {isRecurring && <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('tasks.selectDays')}</span><button type="button" onClick={selectAllDays} className="text-xs font-bold text-blue-600 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400">{t('tasks.everyDay')}</button></div><div className="grid grid-cols-7 gap-1.5">{dayOrder.map((day) => { const selected = recurringDays.includes(day); return <button type="button" key={day} onClick={() => toggleDay(day)} aria-pressed={selected} className={`grid h-10 place-items-center rounded-lg text-xs font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 ${selected ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>{t(DAY_LABEL_KEYS[day]).charAt(0)}</button>; })}</div>{recurringDays.length > 0 && <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400">{getDaysLabel(recurringDays)}</p>}</div>}
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row"><button type="button" onClick={() => setShowModal(false)} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{t('proj.cancel')}</button><button type="submit" className="h-11 flex-1 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white shadow-sm outline-none transition hover:bg-slate-800 focus-visible:ring-4 focus-visible:ring-blue-500/25 dark:bg-blue-600 dark:hover:bg-blue-500">{editingTask ? t('tasks.editTask') : t('tasks.createTask')}</button></div>
            </form>
          </div>
        </div>}
    </section>
  );
}
