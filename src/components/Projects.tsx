'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ArrowUpDown, CheckCircle2, Circle, Edit3, Folder, FolderOpen, LayoutGrid, List, MoreHorizontal, Plus, RotateCcw, Search, SlidersHorizontal, Star, Tags, Timer, Trash2, X } from 'lucide-react';
import { useAppStore, withoutTrashedProjects } from '@/lib/store';
import { createProject, createSession, deleteProject, fetchGoals, fetchProjectsFresh, fetchSessions, fetchTasks, updateProject, updateTask } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Project, Task } from '@/lib/types';
import { useShallow } from '@/lib/useAppShallow';
import { parseLocalDate, toLocalDateKey } from '@/lib/localDate';

const COLORS = ['#1E293B', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

const copy = {
  ar: {
    title: 'المشاريع', subtitle: 'نظّم مشاريعك وتابع تقدمك بكفاءة', search: 'ابحث في المشاريع...',
    all: 'كل المشاريع', standalone: 'مشاريع مستقلة', insideFolder: 'داخل مجلد', sortRecent: 'حسب الأحدث',
    sortName: 'حسب الاسم', sortProgress: 'حسب التقدم', sortTime: 'حسب الوقت', folders: 'المجلدات',
    selectedFolder: 'المجلد المحدد', standaloneProjects: 'المشاريع المستقلة', projects: 'مشاريع', project: 'مشروع',
    trackedTime: 'إجمالي الوقت', sessions: 'جلسات', tasks: 'المهام', lastActivity: 'آخر نشاط',
    noActivity: 'لا يوجد نشاط بعد', noTags: 'بدون وسوم', progress: 'التقدم', complete: 'مكتمل',
    inProgress: 'قيد التنفيذ', notStarted: 'لم يبدأ', openFolder: 'عرض المشاريع', addProject: 'إضافة مشروع',
    newFolder: 'إضافة مجلد', newProject: 'إضافة مشروع', grid: 'شبكة', list: 'قائمة',
    emptyFolder: 'لا توجد مشاريع داخل هذا المجلد بعد', noProjects: 'لا توجد مشاريع مطابقة',
    noProjectsHint: 'أنشئ مجلدًا أو مشروعًا جديدًا للبدء.', edit: 'تعديل', delete: 'نقل إلى المهملات',
    addTime: 'إضافة وقت', plannedTime: 'الوقت المخطط', actualVsPlanned: 'الفعلي / المخطط', status: 'الحالة', clearFolder: 'عرض الكل', rating: 'التقييم',
    created: 'تاريخ الإنشاء', close: 'إغلاق', cancel: 'إلغاء', save: 'حفظ', description: 'الوصف',
    folderName: 'اسم المجلد', name: 'اسم المشروع', inside: 'داخل مجلد', noFolder: 'بدون مجلد',
    color: 'اللون', hours: 'الساعات', minutes: 'الدقائق', date: 'التاريخ', saveTime: 'حفظ الوقت',
    taskPending: 'مهام معلقة', taskDone: 'مهام مكتملة', trash: 'المهملات', emptyTrash: 'إفراغ المهملات',
    restore: 'استعادة', permanentDelete: 'حذف نهائي', deletedAt: 'تم الحذف', addProjectHere: 'إضافة مشروع هنا',
  },
  en: {
    title: 'Projects', subtitle: 'Organize your work and follow progress with clarity', search: 'Search projects...',
    all: 'All projects', standalone: 'Standalone', insideFolder: 'In folders', sortRecent: 'Most recent',
    sortName: 'Name', sortProgress: 'Progress', sortTime: 'Tracked time', folders: 'Folders',
    selectedFolder: 'Selected folder', standaloneProjects: 'Standalone projects', projects: 'projects', project: 'project',
    trackedTime: 'Total time', sessions: 'Sessions', tasks: 'Tasks', lastActivity: 'Last activity',
    noActivity: 'No activity yet', noTags: 'No tags', progress: 'Progress', complete: 'Complete',
    inProgress: 'In progress', notStarted: 'Not started', openFolder: 'View projects', addProject: 'Add project',
    newFolder: 'New folder', newProject: 'New project', grid: 'Grid', list: 'List',
    emptyFolder: 'There are no projects in this folder yet', noProjects: 'No matching projects',
    noProjectsHint: 'Create a folder or a project to get started.', edit: 'Edit', delete: 'Move to trash',
    addTime: 'Add time', plannedTime: 'Planned time', actualVsPlanned: 'Actual / planned', status: 'Status', clearFolder: 'View all', rating: 'Rating',
    created: 'Created', close: 'Close', cancel: 'Cancel', save: 'Save', description: 'Description',
    folderName: 'Folder name', name: 'Project name', inside: 'Inside folder', noFolder: 'No folder',
    color: 'Color', hours: 'Hours', minutes: 'Minutes', date: 'Date', saveTime: 'Save time',
    taskPending: 'Pending tasks', taskDone: 'Completed tasks', trash: 'Trash', emptyTrash: 'Empty trash',
    restore: 'Restore', permanentDelete: 'Delete permanently', deletedAt: 'Deleted', addProjectHere: 'Add project here',
  },
} as const;

function minutesLabel(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function Projects() {
  const {
    projects, sessions, tasks, deletedProjects, projectRatings, projectPlans, language,
    setProjects, setSessions, setTasks, setGoals, addProject, addSession, updateProject: updateProjectInStore,
    updateTask: updateTaskInStore, moveToTrash, restoreFromTrash, removeTrashProjects, addToast, setProjectRating, setProjectPlan,
  } = useAppStore(useShallow((state) => ({
    projects: state.projects, sessions: state.sessions, tasks: state.tasks, deletedProjects: state.deletedProjects,
    projectRatings: state.projectRatings, projectPlans: state.projectPlans, language: state.language, setProjects: state.setProjects, setSessions: state.setSessions,
    setTasks: state.setTasks, setGoals: state.setGoals, addProject: state.addProject, addSession: state.addSession,
    updateProject: state.updateProject, updateTask: state.updateTask, moveToTrash: state.moveToTrash,
    restoreFromTrash: state.restoreFromTrash, removeTrashProjects: state.removeTrashProjects, addToast: state.addToast,
    setProjectRating: state.setProjectRating, setProjectPlan: state.setProjectPlan,
  })));
  const t = useT();
  const lang = language === 'en' ? 'en' : 'ar';
  const c = copy[lang];

  const [showModal, setShowModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [timeProjectId, setTimeProjectId] = useState<string | null>(null);
  const [timeProjectName, setTimeProjectName] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [isFolder, setIsFolder] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [plannedHours, setPlannedHours] = useState('');
  const [timeDate, setTimeDate] = useState(toLocalDateKey());
  const [timeHours, setTimeHours] = useState('1');
  const [timeMinutes, setTimeMinutes] = useState('0');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<'all' | 'standalone' | 'inFolder'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'progress' | 'time'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
  const [trashBusy, setTrashBusy] = useState(false);
  const pendingCreate = useAppStore((state) => state.pendingCreate);
  const setPendingCreate = useAppStore((state) => state.setPendingCreate);

  const folders = useMemo(() => projects.filter((project) => project.is_folder && !project.parent_id), [projects]);
  const availableFolders = useMemo(() => folders.filter((folder) => folder.id !== editingProject?.id), [folders, editingProject]);
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) || null;

  const statsFor = (project: Project) => {
    const projectTasks = tasks.filter((task) => task.project_id === project.id);
    const projectSessions = sessions.filter((session) => session.project_id === project.id);
    const completed = projectTasks.filter((task) => task.is_completed).length;
    const totalMinutes = projectSessions.reduce((total, session) => total + session.duration, 0);
    const lastSession = [...projectSessions].sort((a, b) => b.session_date.localeCompare(a.session_date))[0];
    const activityDate = lastSession?.session_date || project.updated_at || project.created_at;
    return {
      tasks: projectTasks, completed, totalTasks: projectTasks.length, sessions: projectSessions.length, totalMinutes,
      progress: projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0,
      activityDate,
    };
  };

  const folderStats = (folder: Project) => {
    const children = projects.filter((project) => project.parent_id === folder.id && !project.is_folder);
    const childStats = children.map(statsFor);
    const taskCount = childStats.reduce((total, stats) => total + stats.totalTasks, 0);
    const completed = childStats.reduce((total, stats) => total + stats.completed, 0);
    return {
      children,
      totalMinutes: childStats.reduce((total, stats) => total + stats.totalMinutes, 0),
      progress: taskCount ? Math.round((completed / taskCount) * 100) : 0,
    };
  };

  const visibleProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = projects.filter((project) => !project.is_folder);
    if (selectedFolderId) result = result.filter((project) => project.parent_id === selectedFolderId);
    else if (projectFilter === 'standalone') result = result.filter((project) => !project.parent_id);
    else if (projectFilter === 'inFolder') result = result.filter((project) => Boolean(project.parent_id));
    else result = result.filter((project) => !project.parent_id);
    if (query) result = result.filter((project) => `${project.name} ${project.description || ''}`.toLowerCase().includes(query));
    return [...result].sort((left, right) => {
      if (sortBy === 'name') return left.name.localeCompare(right.name, lang === 'ar' ? 'ar' : 'en');
      if (sortBy === 'progress') return statsFor(right).progress - statsFor(left).progress;
      if (sortBy === 'time') return statsFor(right).totalMinutes - statsFor(left).totalMinutes;
      return (right.updated_at || right.created_at).localeCompare(left.updated_at || left.created_at);
    });
  // Derived presentation values only; source records remain unchanged.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, tasks, sessions, selectedFolderId, projectFilter, searchQuery, sortBy, lang]);

  const visibleFolders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return folders.filter((folder) => !query || `${folder.name} ${folder.description || ''}`.toLowerCase().includes(query));
  }, [folders, searchQuery]);

  const resetForm = () => {
    setName(''); setDescription(''); setColor(COLORS[0]); setIsFolder(false); setParentId(null); setEditingProject(null); setFormError(''); setPlannedHours('');
  };
  const openCreateProject = (folderId: string | null = null) => { resetForm(); setParentId(folderId); setShowModal(true); };
  const openCreateFolder = () => { resetForm(); setIsFolder(true); setShowModal(true); };
  const openEdit = (project: Project) => {
    setEditingProject(project); setName(project.name); setDescription(project.description || ''); setColor(project.color || COLORS[0]);
    setIsFolder(project.is_folder); setParentId(project.parent_id); setFormError(''); setPlannedHours(projectPlans[project.id] ? String(projectPlans[project.id] / 60) : ''); setShowModal(true);
  };
  const openDetail = (project: Project) => { setDetailProject(project); setShowDetailModal(true); };
  const openAddTime = (project: Project) => {
    setTimeProjectId(project.id); setTimeProjectName(project.name); setTimeDate(toLocalDateKey()); setTimeHours('1'); setTimeMinutes('0'); setShowTimeModal(true);
  };

  useEffect(() => {
    if (pendingCreate !== 'project') return;
    const frame = requestAnimationFrame(() => {
      resetForm(); setParentId(selectedFolderId); setShowModal(true); setPendingCreate(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingCreate, selectedFolderId, setPendingCreate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setFormError(t('proj.requiredName')); return; }
    try {
      if (editingProject) {
        const updated = await updateProject(editingProject.id, useAppStore.getState().userId || '', {
          name: name.trim(), description: description.trim() || null, color, is_folder: isFolder, parent_id: isFolder ? null : parentId,
        });
        updateProjectInStore(updated);
        if (!setProjectPlan(updated.id, Math.max(0, Number(plannedHours) * 60))) addToast(t('toast.error'), 'error');
      } else {
        const created = await createProject(useAppStore.getState().userId || '', {
          name: name.trim(), description: description.trim() || undefined, color, is_folder: isFolder, parent_id: isFolder ? null : parentId,
        });
        addProject(created);
        if (plannedHours && !setProjectPlan(created.id, Math.max(0, Number(plannedHours) * 60))) addToast(t('toast.error'), 'error');
      }
      setShowModal(false); resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('toast.error'));
      addToast(t('toast.error'), 'error');
    }
  };

  const handleSaveTime = async () => {
    if (!timeProjectId) return;
    const totalMinutes = Math.round((parseFloat(timeHours) || 0) * 60 + (parseInt(timeMinutes) || 0));
    if (totalMinutes <= 0) return;
    try {
      const session = await createSession(useAppStore.getState().userId || '', {
        project_id: timeProjectId, task_id: null, start_time: `${timeDate}T12:00:00`, end_time: `${timeDate}T12:00:00`, duration: totalMinutes, session_date: timeDate,
      });
      addSession(session); setShowTimeModal(false);
    } catch { addToast(t('toast.error'), 'error'); }
  };

  const handleToggleTask = async (task: Task) => {
    setTogglingTaskId(task.id);
    try { updateTaskInStore(await updateTask(task.id, useAppStore.getState().userId || '', { is_completed: !task.is_completed })); }
    catch { addToast(t('toast.error'), 'error'); }
    finally { setTogglingTaskId(null); }
  };

  const handleDelete = (id: string) => {
    const project = projects.find((item) => item.id === id);
    if (!confirm(project?.is_folder ? t('proj.deleteFolderConfirm') : t('proj.moveToTrashConfirm'))) return;
    if (!project) { addToast(t('toast.error'), 'error'); return; }

    const trashTargets = project.is_folder
      ? [project, ...projects.filter((item) => item.parent_id === project.id)]
      : [project];
    const movedIds: string[] = [];
    for (const target of trashTargets) {
      if (moveToTrash(target)) movedIds.push(target.id);
      else {
        movedIds.reverse().forEach((movedId) => restoreFromTrash(movedId));
        addToast(t('toast.error'), 'error');
        return;
      }
    }
    if (movedIds.includes(selectedFolderId || '')) setSelectedFolderId(null);
    addToast(t('proj.deletedSuccess'), 'info', {
      actionLabel: lang === 'ar' ? 'تراجع' : 'Undo',
      duration: 6500,
      onAction: () => {
        const restored = trashTargets.map((target) => restoreFromTrash(target.id)).every(Boolean);
        addToast(restored ? t('proj.restoreSuccess') : t('proj.restoreFailed'), restored ? 'success' : 'error');
      },
    });
  };

  const refreshProjectData = async (userId: string) => {
    const [freshProjects, freshTasks, freshSessions, freshGoals] = await Promise.all([fetchProjectsFresh(userId), fetchTasks(userId), fetchSessions(userId), fetchGoals(userId)]);
    if (useAppStore.getState().userId !== userId) return false;
    setProjects(withoutTrashedProjects(freshProjects, useAppStore.getState().deletedProjects)); setTasks(freshTasks); setSessions(freshSessions); setGoals(freshGoals);
    return true;
  };
  const handleRestore = async (id: string) => {
    try {
      const userId = useAppStore.getState().userId || '';
      const freshProjects = await fetchProjectsFresh(userId);
      if (useAppStore.getState().userId !== userId || !freshProjects.some((project) => project.id === id)) return;
      if (!restoreFromTrash(id)) throw new Error('Restore failed');
      setProjects(withoutTrashedProjects(freshProjects, useAppStore.getState().deletedProjects)); addToast(t('proj.restoreSuccess'), 'success');
    } catch { addToast(t('proj.restoreFailed'), 'error'); }
  };
  const handlePermanentDelete = async (id: string) => {
    if (!confirm(t('proj.permanentDeleteConfirm'))) return;
    try {
      const userId = useAppStore.getState().userId || '';
      await deleteProject(id, userId);
      if (useAppStore.getState().userId !== userId) return;
      if (!removeTrashProjects([id])) throw new Error('Trash update failed');
      await refreshProjectData(userId); addToast(t('proj.permanentDeleteSuccess'), 'success');
    } catch { addToast(t('toast.error'), 'error'); }
  };
  const handleEmptyTrash = async () => {
    if (trashBusy || !confirm(t('proj.emptyTrashConfirm'))) return;
    setTrashBusy(true);
    try {
      const userId = useAppStore.getState().userId || '';
      const ids = deletedProjects.map((item) => item.project.id);
      const results = await Promise.allSettled(ids.map((id) => deleteProject(id, userId)));
      if (useAppStore.getState().userId !== userId) return;
      const completedIds = ids.filter((_, index) => results[index].status === 'fulfilled');
      if (completedIds.length && !removeTrashProjects(completedIds)) throw new Error('Trash update failed');
      if (completedIds.length) await refreshProjectData(userId);
      addToast(completedIds.length === ids.length ? t('proj.emptyTrashSuccess') : t('proj.emptyTrashPartial'), completedIds.length === ids.length ? 'success' : 'error');
    } catch { addToast(t('toast.error'), 'error'); }
    finally { setTrashBusy(false); }
  };

  const dateLabel = (date: string) => {
    try { return parseLocalDate(date.slice(0, 10)).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' }); }
    catch { return date; }
  };
  const starRating = (projectId: string, size = 14) => {
    const rating = projectRatings[projectId] || 0;
    return <div className="flex gap-0.5" onClick={(event) => event.stopPropagation()}>{[1, 2, 3].map((star) => <button key={star} type="button" aria-label={`${c.rating} ${star}`} onClick={() => setProjectRating(projectId, star === rating ? 0 : star)} className="transition-transform hover:scale-110"><Star size={size} className={star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'} /></button>)}</div>;
  };

  const projectCard = (project: Project) => {
    const stats = statsFor(project);
    const status = stats.progress === 100 ? c.complete : stats.progress > 0 ? c.inProgress : c.notStarted;
    const statusClass = stats.progress === 100 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : stats.progress > 0 ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300';
    return (
      <article key={project.id} onClick={() => openDetail(project)} className={`group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_14px_32px_rgba(76,29,149,0.10)] dark:border-slate-700 dark:bg-slate-800 ${viewMode === 'list' ? 'flex flex-col gap-4 sm:flex-row sm:items-center' : ''}`}>
        <div className={`flex min-w-0 items-start justify-between gap-3 ${viewMode === 'list' ? 'sm:w-[35%]' : ''}`}>
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${project.color || COLORS[0]}18`, color: project.color || COLORS[0] }}><FolderOpen size={21} /></div>
            <div className="min-w-0"><h3 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{project.name}</h3><p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{project.description || c.noTags}</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => openAddTime(project)} title={c.addTime} className="rounded-lg p-1.5 text-blue-500 transition hover:bg-blue-50 dark:hover:bg-blue-500/10"><Timer size={15} /></button>
            <button type="button" onClick={() => openEdit(project)} title={c.edit} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700"><Edit3 size={15} /></button>
            <button type="button" onClick={() => handleDelete(project.id)} title={c.delete} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"><MoreHorizontal size={16} /></button>
          </div>
        </div>
        <div className={`min-w-0 ${viewMode === 'list' ? 'sm:flex-1' : ''}`}>
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px]"><span className="font-medium text-slate-500 dark:text-slate-400">{c.progress}</span><span className="font-bold text-slate-700 dark:text-slate-200">{stats.completed}/{stats.totalTasks} · {stats.progress}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${stats.progress}%`, backgroundColor: project.color || '#7c3aed' }} /></div>
        </div>
        <div className={`grid grid-cols-4 gap-2 border-t border-slate-100 pt-3 text-center dark:border-slate-700 ${viewMode === 'list' ? 'sm:w-[42%] sm:border-t-0 sm:pt-0' : ''}`}>
          <div><span className="block text-sm font-bold text-slate-700 dark:text-slate-200">{minutesLabel(stats.totalMinutes)}</span><span className="text-[10px] text-slate-400">{c.trackedTime}</span></div>
          <div className="border-s border-slate-100 dark:border-slate-700"><span className="block text-sm font-bold text-slate-700 dark:text-slate-200">{projectPlans[project.id] ? minutesLabel(projectPlans[project.id]) : '—'}</span><span className="text-[10px] text-slate-400">{c.plannedTime}</span></div>
          <div className="border-x border-slate-100 dark:border-slate-700"><span className="block text-sm font-bold text-slate-700 dark:text-slate-200">{stats.sessions}</span><span className="text-[10px] text-slate-400">{c.sessions}</span></div>
          <div><span className="block text-sm font-bold text-slate-700 dark:text-slate-200">{stats.totalTasks}</span><span className="text-[10px] text-slate-400">{c.tasks}</span></div>
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400"><span className="flex items-center gap-1"><Activity size={11} className="text-emerald-500" />{c.lastActivity}: {stats.sessions ? dateLabel(stats.activityDate) : c.noActivity}</span><span className={`rounded-full px-2 py-1 font-semibold ${statusClass}`}>{status}</span></div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-700"><span className="flex items-center gap-1 text-[10px] text-slate-400"><Tags size={11} />{c.noTags}</span>{starRating(project.id)}</div>
      </article>
    );
  };

  const detailStats = detailProject ? statsFor(detailProject) : null;

  return (
    <div className="sabeel-page-enter">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{c.title}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{c.subtitle}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={openCreateFolder} className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3.5 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200"><Folder size={16} />{c.newFolder}</button>
          <button type="button" onClick={() => openCreateProject(selectedFolderId)} className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-violet-700 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(109,40,217,0.22)] transition hover:-translate-y-0.5"><Plus size={17} />{c.newProject}</button>
        </div>
      </div>

      <section className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative block min-w-0 flex-1"><Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={c.search} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pe-3 ps-9 text-sm text-slate-800 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-slate-600 dark:bg-slate-700/70 dark:text-slate-100 dark:focus:bg-slate-700" /></label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-slate-200 p-1 dark:border-slate-600"><button type="button" onClick={() => setViewMode('grid')} aria-label={c.grid} className={`rounded-lg p-2 transition ${viewMode === 'grid' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><LayoutGrid size={15} /></button><button type="button" onClick={() => setViewMode('list')} aria-label={c.list} className={`rounded-lg p-2 transition ${viewMode === 'list' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><List size={15} /></button></div>
            <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-2 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300"><SlidersHorizontal size={14} /><select value={projectFilter} onChange={(event) => { setProjectFilter(event.target.value as typeof projectFilter); setSelectedFolderId(null); }} className="bg-transparent outline-none"><option value="all">{c.all}</option><option value="standalone">{c.standalone}</option><option value="inFolder">{c.insideFolder}</option></select></label>
            <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-2 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300"><ArrowUpDown size={14} /><select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="bg-transparent outline-none"><option value="recent">{c.sortRecent}</option><option value="name">{c.sortName}</option><option value="progress">{c.sortProgress}</option><option value="time">{c.sortTime}</option></select></label>
          </div>
        </div>
      </section>

      {folders.length > 0 && (
        <section className="mb-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{c.folders}</h2>
            {selectedFolder && <button type="button" onClick={() => setSelectedFolderId(null)} className="text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-300">{c.clearFolder}</button>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleFolders.map((folder) => {
              const stats = folderStats(folder);
              const selected = selectedFolderId === folder.id;
              return (
                <article key={folder.id} className={`relative overflow-hidden rounded-2xl border transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 ${selected ? 'border-violet-400 bg-violet-50/70 ring-4 ring-violet-500/10 dark:border-violet-500 dark:bg-violet-500/10' : 'border-slate-200 bg-white hover:border-violet-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-800'}`}>
                  <button type="button" onClick={() => setSelectedFolderId(folder.id)} aria-label={`${c.openFolder}: ${folder.name}`} className="w-full p-4 text-start">
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ backgroundColor: `${folder.color || '#8b5cf6'}18`, color: folder.color || '#8b5cf6' }}><Folder size={20} /></div>
                      <span className="me-20 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">{stats.children.length} {c.projects}</span>
                    </div>
                    <h3 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{folder.name}</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{minutesLabel(stats.totalMinutes)} · {stats.progress}%</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-full rounded-full" style={{ width: `${stats.progress}%`, backgroundColor: folder.color || '#8b5cf6' }} /></div>
                  </button>
                  <div className="absolute end-3 top-3 flex items-center gap-1">
                    <button type="button" onClick={() => openEdit(folder)} aria-label={`${c.edit}: ${folder.name}`} title={c.edit} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-violet-500/10"><Edit3 size={14} /></button>
                    <button type="button" onClick={() => handleDelete(folder.id)} aria-label={`${c.delete}: ${folder.name}`} title={c.delete} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-500/10"><Trash2 size={14} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">{selectedFolder ? <FolderOpen size={18} /> : <LayoutGrid size={17} />}</div><div><h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{selectedFolder ? selectedFolder.name : c.standaloneProjects}</h2><p className="text-xs text-slate-400">{visibleProjects.length} {c.projects}</p></div></div>{selectedFolder && <button type="button" onClick={() => openCreateProject(selectedFolder.id)} className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-200"><Plus size={14} />{c.addProjectHere}</button>}</div>
        {visibleProjects.length ? <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3' : 'space-y-3'}>{visibleProjects.map(projectCard)}</div> : <div className="py-14 text-center"><FolderOpen size={40} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" /><h3 className="font-bold text-slate-600 dark:text-slate-300">{selectedFolder ? c.emptyFolder : c.noProjects}</h3><p className="mt-1 text-sm text-slate-400">{c.noProjectsHint}</p><button type="button" onClick={() => openCreateProject(selectedFolderId)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white"><Plus size={15} />{c.newProject}</button></div>}
      </section>

      {deletedProjects.length > 0 && <section className="mt-7"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"><Trash2 size={16} className="text-red-500" />{c.trash}<span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] text-red-600 dark:bg-red-500/10 dark:text-red-300">{deletedProjects.length}</span></h2><button type="button" onClick={handleEmptyTrash} disabled={trashBusy} className="text-xs font-semibold text-red-500 disabled:opacity-50">{c.emptyTrash}</button></div><div className="space-y-2">{deletedProjects.map(({ project, deletedAt }) => <div key={project.id} className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/50 p-3 dark:border-red-500/20 dark:bg-red-500/5"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{project.name}</p><p className="text-[11px] text-slate-400">{c.deletedAt}: {dateLabel(deletedAt)}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => handleRestore(project.id)} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white"><RotateCcw size={12} className="inline" /> {c.restore}</button><button type="button" onClick={() => handlePermanentDelete(project.id)} title={c.permanentDelete} className="rounded-lg p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/10"><Trash2 size={15} /></button></div></div>)}</div></section>}

      {showModal && <div onMouseDown={(event) => event.target === event.currentTarget && setShowModal(false)} className="global-modal-overlay"><div role="dialog" aria-modal="true" className="global-modal-panel max-w-md p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{editingProject ? (editingProject.is_folder ? t('proj.editFolder') : c.edit) : isFolder ? c.newFolder : c.newProject}</h2><button type="button" onClick={() => setShowModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><X size={18} /></button></div><form onSubmit={handleSubmit} className="space-y-4"><label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{isFolder ? c.folderName : c.name}<input autoFocus value={name} onChange={(event) => { setName(event.target.value); setFormError(''); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-600 dark:bg-slate-700" /></label>{formError && <p className="text-xs text-red-500">{formError}</p>}<label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{c.description}<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-slate-600 dark:bg-slate-700" /></label>{!isFolder && availableFolders.length > 0 && <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{c.inside}<select value={parentId || ''} onChange={(event) => setParentId(event.target.value || null)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-600 dark:bg-slate-700"><option value="">{c.noFolder}</option>{availableFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>} {!isFolder && <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{c.plannedTime}<div className="relative mt-1.5"><input type="number" min="0" step="0.5" value={plannedHours} onChange={(event) => setPlannedHours(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pe-16 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-600 dark:bg-slate-700" /><span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{c.hours}</span></div></label>}<div><p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{c.color}</p><div className="flex gap-2">{COLORS.map((item) => <button key={item} type="button" aria-label={item} onClick={() => setColor(item)} className={`h-7 w-7 rounded-full ${color === item ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-800' : ''}`} style={{ backgroundColor: item }} />)}</div></div><div className="flex gap-3 pt-1"><button type="submit" className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white">{c.save}</button><button type="button" onClick={() => setShowModal(false)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{c.cancel}</button></div></form></div></div>}

      <AnimatePresence>{showTimeModal && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTimeModal(false)} transition={{ duration: 0.1 }} className="global-modal-overlay"><motion.div initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.985 }} transition={{ duration: 0.12, ease: 'easeOut' }} onClick={(event) => event.stopPropagation()} className="global-modal-panel w-full max-w-sm p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{c.addTime}</h2><p className="mt-1 text-sm text-slate-400">{timeProjectName}</p></div><button type="button" onClick={() => setShowTimeModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><X size={18} /></button></div><div className="space-y-4"><label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{c.date}<input type="date" value={timeDate} onChange={(event) => setTimeDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700" /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium text-slate-700 dark:text-slate-200">{c.hours}<input type="number" value={timeHours} onChange={(event) => setTimeHours(event.target.value)} min="0" max="24" step="0.5" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700" /></label><label className="text-sm font-medium text-slate-700 dark:text-slate-200">{c.minutes}<input type="number" value={timeMinutes} onChange={(event) => setTimeMinutes(event.target.value)} min="0" max="59" step="5" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700" /></label></div><div className="flex gap-3"><button type="button" onClick={handleSaveTime} className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white">{c.saveTime}</button><button type="button" onClick={() => setShowTimeModal(false)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{c.cancel}</button></div></div></motion.div></motion.div>}</AnimatePresence>

      <AnimatePresence>
        {showDetailModal && detailProject && detailStats && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} onClick={() => setShowDetailModal(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ backgroundColor: `${detailProject.color || COLORS[0]}18`, color: detailProject.color || COLORS[0] }}><FolderOpen size={21} /></div>
                  <div className="min-w-0"><h2 className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">{detailProject.name}</h2><p className="mt-0.5 text-sm text-slate-400">{detailProject.description || c.noTags}</p></div>
                </div>
                <button type="button" onClick={() => setShowDetailModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><X size={18} /></button>
              </div>
              <div className="mb-5 flex items-center justify-between">{starRating(detailProject.id, 20)}<span className="text-xs text-slate-400">{c.created}: {dateLabel(detailProject.created_at)}</span></div>
              <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-900"><b className="block text-sm text-slate-700 dark:text-slate-200">{minutesLabel(detailStats.totalMinutes)}</b><span className="text-[10px] text-slate-400">{c.trackedTime}</span></div>
                <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-900"><b className="block text-sm text-slate-700 dark:text-slate-200">{projectPlans[detailProject.id] ? minutesLabel(projectPlans[detailProject.id]) : '—'}</b><span className="text-[10px] text-slate-400">{c.plannedTime}</span></div>
                <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-900"><b className="block text-sm text-slate-700 dark:text-slate-200">{detailStats.sessions}</b><span className="text-[10px] text-slate-400">{c.sessions}</span></div>
                <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-900"><b className="block text-sm text-slate-700 dark:text-slate-200">{detailStats.completed}/{detailStats.totalTasks}</b><span className="text-[10px] text-slate-400">{c.tasks}</span></div>
              </div>
              <div className="mb-5">
                <div className="mb-1.5 flex justify-between text-xs text-slate-500"><span>{c.progress}</span><b>{detailStats.progress}%</b></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-full rounded-full" style={{ width: `${detailStats.progress}%`, backgroundColor: detailProject.color || '#7c3aed' }} /></div>
                <div className="mt-5 flex gap-2"><button type="button" onClick={() => openAddTime(detailProject)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-50 py-2 text-xs font-bold text-violet-700 dark:bg-violet-500/10 dark:text-violet-200"><Timer size={14} />{c.addTime}</button><button type="button" onClick={() => openEdit(detailProject)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200"><Edit3 size={14} />{c.edit}</button></div>
              </div>
              <div><h3 className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">{c.tasks}</h3>
                {detailStats.tasks.length ? <div className="space-y-1.5">{detailStats.tasks.map((task) => <button type="button" key={task.id} onClick={() => handleToggleTask(task)} disabled={togglingTaskId === task.id} className="flex w-full items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-start text-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-700"><span>{task.is_completed ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-slate-300 dark:text-slate-600" />}</span><span className={`flex-1 ${task.is_completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{task.title}</span>{togglingTaskId === task.id && <span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-300 border-t-transparent" />}</button>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400 dark:bg-slate-900">{c.noActivity}</p>}
              </div>
              <button type="button" onClick={() => setShowDetailModal(false)} className="mt-5 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{c.close}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
