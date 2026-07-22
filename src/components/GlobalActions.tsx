'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3, BookOpen, CheckSquare2, Clock3, FolderKanban, Goal,
  GripVertical, Pause, PictureInPicture2, Play, Plus, Search, Sparkles, X,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useShallow } from '@/lib/useAppShallow';
import type { ActiveView, QuickCreate } from '@/lib/types';
import { readStorageJson, writeStorageJson } from '@/lib/storage';

type DocumentPictureInPictureController = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
};

const formatTimer = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.max(0, seconds % 60)).padStart(2, '0')}`;

export default function GlobalActions() {
  const {
    language, darkMode, activeView, projects, tasks, sessions, goals, timerState, timerSeconds,
    setActiveView, setPendingCreate, addToast,
  } = useAppStore(useShallow((state) => ({
    language: state.language,
    darkMode: state.darkMode,
    activeView: state.activeView,
    projects: state.projects,
    tasks: state.tasks,
    sessions: state.sessions,
    goals: state.goals,
    timerState: state.timerState,
    timerSeconds: state.timerSeconds,
    setActiveView: state.setActiveView,
    setPendingCreate: state.setPendingCreate,
    addToast: state.addToast,
  })));
  const ar = language === 'ar';
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pictureWindow, setPictureWindow] = useState<Window | null>(null);
  const [pictureAddOpen, setPictureAddOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!pictureWindow) return;
    pictureWindow.document.documentElement.dir = ar ? 'rtl' : 'ltr';
    pictureWindow.document.documentElement.classList.toggle('dark', darkMode);
    pictureWindow.document.body.style.background = darkMode ? '#080d17' : '#f8fafc';
  }, [ar, darkMode, pictureWindow]);

  useEffect(() => {
    const saved = readStorageJson<{ x: number; y: number } | null>('sabeel_global_toolbar_position', null, (value) => {
      if (!value || typeof value !== 'object') return false;
      const point = value as { x?: unknown; y?: unknown };
      return typeof point.x === 'number' && typeof point.y === 'number';
    });
    const frame = requestAnimationFrame(() => {
      if (saved) setToolbarPosition(saved);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const clampToolbarPosition = (x: number, y: number) => {
    const width = toolbarRef.current?.offsetWidth || 270;
    const height = toolbarRef.current?.offsetHeight || 58;
    return {
      x: Math.min(Math.max(12, x), Math.max(12, window.innerWidth - width - 12)),
      y: Math.min(Math.max(12, y), Math.max(12, window.innerHeight - height - 12)),
    };
  };

  const beginToolbarDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = toolbarRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveToolbar = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    setToolbarPosition(clampToolbarPosition(event.clientX - dragRef.current.dx, event.clientY - dragRef.current.dy));
  };

  const endToolbarDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setToolbarPosition((position) => {
      if (position) writeStorageJson('sabeel_global_toolbar_position', position);
      return position;
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setAddOpen(false);
        setReviewOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (searchOpen) inputRef.current?.focus();
      else setQuery('');
    });
    return () => cancelAnimationFrame(frame);
  }, [searchOpen]);

  const pages = useMemo(() => [
    { id: 'dashboard' as ActiveView, ar: 'الرئيسية', en: 'Dashboard', icon: BarChart3 },
    { id: 'projects' as ActiveView, ar: 'المشاريع', en: 'Projects', icon: FolderKanban },
    { id: 'tasks' as ActiveView, ar: 'المهام', en: 'Tasks', icon: CheckSquare2 },
    { id: 'sessions' as ActiveView, ar: 'سجلات الوقت', en: 'Sessions', icon: Clock3 },
    { id: 'analytics' as ActiveView, ar: 'الإحصائيات', en: 'Analytics', icon: BarChart3 },
    { id: 'goals' as ActiveView, ar: 'الأهداف', en: 'Goals', icon: Goal },
    { id: 'library' as ActiveView, ar: 'المكتبة', en: 'Library', icon: BookOpen },
  ], []);

  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    const all = [
      ...pages.map((page) => ({ key: `page-${page.id}`, label: ar ? page.ar : page.en, detail: ar ? 'صفحة' : 'Page', view: page.id, icon: page.icon })),
      ...projects.map((project) => ({ key: `project-${project.id}`, label: project.name, detail: ar ? 'مشروع' : 'Project', view: 'projects' as ActiveView, icon: FolderKanban })),
      ...tasks.map((task) => ({ key: `task-${task.id}`, label: task.title, detail: ar ? 'مهمة' : 'Task', view: 'tasks' as ActiveView, icon: CheckSquare2 })),
      ...goals.map((goal) => ({ key: `goal-${goal.id}`, label: goal.title || (ar ? 'هدف قياسي' : 'Metric goal'), detail: ar ? 'هدف' : 'Goal', view: 'goals' as ActiveView, icon: Goal })),
    ];
    return (value ? all.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(value)) : all).slice(0, 10);
  }, [ar, goals, pages, projects, query, tasks]);

  const week = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    const recent = sessions.filter((session) => new Date(session.start_time || session.created_at) >= start);
    const totalMinutes = recent.reduce((sum, session) => sum + (session.duration || 0), 0);
    const activeDays = new Set(recent.map((session) => session.session_date)).size;
    const completedTasks = tasks.filter((task) => task.is_completed && new Date(task.updated_at) >= start).length;
    const byProject: Record<string, number> = {};
    recent.forEach((session) => {
      if (session.project_id) byProject[session.project_id] = (byProject[session.project_id] || 0) + (session.duration || 0);
    });
    const topId = Object.entries(byProject).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0];
    return { totalMinutes, activeDays, completedTasks, sessions: recent.length, topProject: projects.find((project) => project.id === topId)?.name };
  }, [projects, sessions, tasks]);

  const openCreate = (kind: QuickCreate, view: ActiveView) => {
    setAddOpen(false);
    setActiveView(view);
    setPendingCreate(kind === 'prayer' ? null : kind);
  };

  const toggleTimer = () => {
    const store = useAppStore.getState();
    if (timerState === 'running' || timerState === 'break') store.pauseTimer?.();
    else if (timerState === 'paused') store.resumeTimer?.();
    else store.startTimer?.();
  };

  const openPictureToolbar = async () => {
    if (pictureWindow && !pictureWindow.closed) {
      pictureWindow.focus();
      return;
    }
    const controller = (window as Window & { documentPictureInPicture?: DocumentPictureInPictureController }).documentPictureInPicture;
    if (!controller) {
      addToast(ar ? 'المتصفح لا يدعم النافذة العائمة. استخدم أحدث إصدار من Chrome أو Edge.' : 'Your browser does not support the floating window. Use the latest Chrome or Edge.', 'error');
      return;
    }
    try {
      const pip = await controller.requestWindow({ width: 430, height: 96 });
      pip.document.title = ar ? 'اختصارات سبيل' : 'Sabeel shortcuts';
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((source) => {
        const link = pip.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = source.href;
        pip.document.head.appendChild(link);
      });
      document.querySelectorAll<HTMLStyleElement>('style').forEach((source) => pip.document.head.appendChild(source.cloneNode(true)));
      pip.document.body.style.margin = '0';
      pip.document.body.style.overflow = 'hidden';
      pip.document.body.style.background = darkMode ? '#080d17' : '#f8fafc';
      pip.document.documentElement.dir = ar ? 'rtl' : 'ltr';
      pip.document.documentElement.classList.toggle('dark', darkMode);
      pip.addEventListener('pagehide', () => { setPictureWindow(null); setPictureAddOpen(false); }, { once: true });
      setPictureWindow(pip);
    } catch {
      addToast(ar ? 'تعذر فتح شريط الاختصارات العائم.' : 'Could not open the floating shortcut bar.', 'error');
    }
  };

  const togglePictureAdd = () => {
    const nextOpen = !pictureAddOpen;
    // Chrome permits resizing a Document Picture-in-Picture window only from
    // a direct user gesture, so keep this inside the + button handler.
    try { pictureWindow?.resizeTo(430, nextOpen ? 190 : 96); } catch { /* The menu still works at the current size. */ }
    setPictureAddOpen(nextOpen);
  };

  const quickItems: Array<{ kind: QuickCreate; view: ActiveView; labelAr: string; labelEn: string; icon: typeof Plus }> = [
    { kind: 'project', view: 'projects', labelAr: 'مشروع جديد', labelEn: 'New project', icon: FolderKanban },
    { kind: 'task', view: 'tasks', labelAr: 'مهمة جديدة', labelEn: 'New task', icon: CheckSquare2 },
    { kind: 'session', view: 'sessions', labelAr: 'جلسة يدوية', labelEn: 'Manual session', icon: Clock3 },
    { kind: 'goal', view: 'goals', labelAr: 'هدف جديد', labelEn: 'New goal', icon: Goal },
    { kind: 'prayer', view: 'prayers', labelAr: 'تسجيل عبادة', labelEn: 'Log worship', icon: Sparkles },
  ];

  return (
    <>
      <div ref={toolbarRef} style={toolbarPosition ? { left: toolbarPosition.x, top: toolbarPosition.y } : undefined} className={`fixed z-40 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_18px_48px_rgba(15,23,42,.16)] dark:border-[#26334a] dark:bg-[#111a2a]/95 ${toolbarPosition ? '' : 'top-5 end-5'}`}>
        <button type="button" onPointerDown={beginToolbarDrag} onPointerMove={moveToolbar} onPointerUp={endToolbarDrag} onPointerCancel={endToolbarDrag} className="global-action-button cursor-grab touch-none active:cursor-grabbing" aria-label={ar ? 'تحريك شريط الاختصارات' : 'Move shortcut toolbar'} title={ar ? 'اسحب لتحريك الشريط' : 'Drag to move'}><GripVertical size={18} /></button>
        <button type="button" onClick={openPictureToolbar} className="global-action-button" aria-label={ar ? 'إبقاء الاختصارات فوق كل النوافذ' : 'Keep shortcuts above other windows'} title={ar ? 'خلي الشريط معك حتى تقفله' : 'Keep the bar with you until closed'}><PictureInPicture2 size={18} /></button>
        <button type="button" onClick={() => setSearchOpen(true)} className="global-action-button" aria-label={ar ? 'بحث شامل' : 'Global search'} title="Ctrl+K"><Search size={18} /></button>
        <button type="button" onClick={() => setReviewOpen(true)} className="global-action-button" aria-label={ar ? 'المراجعة الأسبوعية' : 'Weekly review'}><BarChart3 size={18} /></button>
        <button type="button" onClick={toggleTimer} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 font-mono text-sm font-black text-slate-800 transition hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-[#26334a] dark:text-white dark:hover:bg-[#18243a]" aria-label={ar ? 'التحكم في المؤقت' : 'Timer control'}>
          {timerState === 'running' || timerState === 'break' ? <Pause size={17} /> : <Play size={17} />}
          <span dir="ltr">{formatTimer(timerSeconds)}</span>
        </button>
        <div className="relative">
          <button type="button" onClick={() => setAddOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/20 transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2" aria-expanded={addOpen} aria-label={ar ? 'إضافة جديد' : 'Add new'}><Plus size={20} /></button>
          {addOpen && <div className="absolute top-12 end-0 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-[#26334a] dark:bg-[#111a2a]">
            {quickItems.map((item) => <button key={item.kind} type="button" onClick={() => openCreate(item.kind, item.view)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm font-bold text-slate-700 transition hover:bg-violet-50 hover:text-violet-700 dark:text-slate-200 dark:hover:bg-[#18243a] dark:hover:text-violet-300"><item.icon size={17} />{ar ? item.labelAr : item.labelEn}</button>)}
          </div>}
        </div>
      </div>

      {pictureWindow && createPortal(
        <div className="min-h-screen bg-slate-50 p-2 dark:bg-[#080d17]" dir={ar ? 'rtl' : 'ltr'}>
          <div className="relative flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-[#26334a] dark:bg-[#111a2a]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600 font-black text-white">س</span>
            <button type="button" onClick={() => { window.focus(); setSearchOpen(true); }} className="global-action-button" aria-label={ar ? 'بحث شامل' : 'Global search'}><Search size={18} /></button>
            <button type="button" onClick={() => { window.focus(); setReviewOpen(true); }} className="global-action-button" aria-label={ar ? 'المراجعة الأسبوعية' : 'Weekly review'}><BarChart3 size={18} /></button>
            <button type="button" onClick={toggleTimer} className="flex h-10 min-w-28 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 font-mono text-sm font-black text-slate-800 hover:border-violet-300 hover:bg-violet-50 dark:border-[#26334a] dark:text-white dark:hover:bg-[#18243a]">
              {timerState === 'running' || timerState === 'break' ? <Pause size={17} /> : <Play size={17} />}<span dir="ltr">{formatTimer(timerSeconds)}</span>
            </button>
            <button type="button" onClick={togglePictureAdd} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white hover:bg-violet-700" aria-expanded={pictureAddOpen} aria-label={ar ? 'إضافة جديد' : 'Add new'}><Plus size={20} /></button>
            {pictureAddOpen && <div className="absolute inset-x-2 top-14 grid grid-cols-5 gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-[#26334a] dark:bg-[#111a2a]">{quickItems.map((item) => <button key={item.kind} type="button" onClick={() => { window.focus(); openCreate(item.kind, item.view); setPictureAddOpen(false); }} className="flex min-w-0 flex-col items-center gap-1 rounded-lg p-2 text-[10px] font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-700 dark:text-slate-300 dark:hover:bg-[#18243a]"><item.icon size={16} /><span className="truncate">{ar ? item.labelAr : item.labelEn}</span></button>)}</div>}
          </div>
        </div>,
        pictureWindow.document.body,
      )}

      {searchOpen && <div className="global-modal-overlay" role="dialog" aria-modal="true" aria-label={ar ? 'البحث الشامل' : 'Global search'} onMouseDown={(event) => event.target === event.currentTarget && setSearchOpen(false)}>
        <div className="global-modal-panel top-[12vh] max-w-2xl self-start p-3">
          <div className="flex items-center gap-3 border-b border-slate-200 px-2 pb-3 dark:border-[#26334a]"><Search className="text-slate-400" size={20} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" placeholder={ar ? 'ابحث في الصفحات والمشاريع والمهام والأهداف...' : 'Search pages, projects, tasks and goals...'} /><kbd className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 dark:border-[#26334a]">Esc</kbd></div>
          <div className="max-h-[55vh] overflow-y-auto py-2">
            {results.length ? results.map((result) => <button key={result.key} type="button" onClick={() => { setActiveView(result.view); setSearchOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition hover:bg-slate-100 focus-visible:bg-violet-50 focus-visible:outline-none dark:hover:bg-[#18243a]"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-[#18243a] dark:text-slate-300"><result.icon size={18} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-slate-900 dark:text-white">{result.label}</span><span className="text-xs text-slate-500 dark:text-slate-400">{result.detail}</span></span></button>) : <p className="p-8 text-center text-sm text-slate-500">{ar ? 'لا توجد نتائج' : 'No results'}</p>}
          </div>
        </div>
      </div>}

      {reviewOpen && <div className="global-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="weekly-review-title" onMouseDown={(event) => event.target === event.currentTarget && setReviewOpen(false)}>
        <div className="global-modal-panel max-w-2xl p-6">
          <div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-1 text-xs font-black text-violet-600">{ar ? 'آخر 7 أيام' : 'LAST 7 DAYS'}</p><h2 id="weekly-review-title" className="text-2xl font-black text-slate-950 dark:text-white">{ar ? 'المراجعة الأسبوعية' : 'Weekly review'}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{ar ? 'ملخص حقيقي من جلساتك ومهامك الحالية' : 'A real summary from your current sessions and tasks'}</p></div><button type="button" onClick={() => setReviewOpen(false)} className="global-action-button" aria-label={ar ? 'إغلاق' : 'Close'}><X size={18} /></button></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[{ value: `${Math.floor(week.totalMinutes / 60)}h ${week.totalMinutes % 60}m`, ar: 'وقت التركيز', en: 'Focus time' }, { value: week.sessions, ar: 'الجلسات', en: 'Sessions' }, { value: week.completedTasks, ar: 'مهام مكتملة', en: 'Tasks done' }, { value: `${week.activeDays}/7`, ar: 'أيام نشطة', en: 'Active days' }].map((item) => <div key={item.en} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#26334a] dark:bg-[#0d1422]"><p className="text-xl font-black text-slate-950 dark:text-white">{item.value}</p><p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{ar ? item.ar : item.en}</p></div>)}
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-500/20 dark:bg-violet-500/10"><Sparkles className="text-violet-600" size={22} /><div><p className="text-sm font-black text-slate-900 dark:text-white">{ar ? 'أكثر مشروع ركزت عليه' : 'Most focused project'}</p><p className="mt-0.5 text-sm text-violet-700 dark:text-violet-300">{week.topProject || (ar ? 'لا توجد جلسات مرتبطة بمشروع هذا الأسبوع' : 'No project sessions this week')}</p></div></div>
          <button type="button" onClick={() => { setReviewOpen(false); setActiveView('analytics'); }} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-violet-600 dark:hover:bg-violet-500"><BarChart3 size={18} />{ar ? 'فتح الإحصائيات الكاملة' : 'Open full analytics'}</button>
        </div>
      </div>}
      <span className="sr-only" aria-live="polite">{activeView}</span>
    </>
  );
}
