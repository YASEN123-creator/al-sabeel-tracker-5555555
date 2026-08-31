'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BriefcaseBusiness, Check, ChevronDown, Folder, Search } from 'lucide-react';
import type { Project } from '@/lib/types';

type PickerFilter = 'all' | 'standalone' | 'folders';

interface ProjectPickerProps {
  projects: Project[];
  value: string;
  onChange: (value: string) => void;
  language: string;
  placeholder: string;
  ariaLabel?: string;
  specialOption?: { value: string; label: string };
  className?: string;
}

export default function ProjectPicker({ projects, value, onChange, language, placeholder, ariaLabel, specialOption, className = '' }: ProjectPickerProps) {
  const isAr = language === 'ar';
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PickerFilter>('all');

  const model = useMemo(() => {
    const rootFolders = projects.filter((project) => project.is_folder && !project.parent_id).sort((a, b) => a.name.localeCompare(b.name, isAr ? 'ar' : 'en'));
    const folderIds = new Set(rootFolders.map((folder) => folder.id));
    const actualProjects = projects.filter((project) => !project.is_folder);
    const standalone = actualProjects.filter((project) => !project.parent_id || !folderIds.has(project.parent_id)).sort((a, b) => a.name.localeCompare(b.name, isAr ? 'ar' : 'en'));
    const groups = rootFolders.map((folder) => ({
      folder,
      projects: actualProjects.filter((project) => project.parent_id === folder.id).sort((a, b) => a.name.localeCompare(b.name, isAr ? 'ar' : 'en')),
    })).filter((group) => group.projects.length > 0);
    return { standalone, groups, actualProjects };
  }, [projects, isAr]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleStandalone = filter === 'folders' ? [] : model.standalone.filter((project) => project.name.toLocaleLowerCase().includes(normalizedQuery));
  const visibleGroups = filter === 'standalone' ? [] : model.groups.map((group) => ({
    ...group,
    projects: group.projects.filter((project) => `${group.folder.name} ${project.name}`.toLocaleLowerCase().includes(normalizedQuery)),
  })).filter((group) => group.projects.length > 0);
  const selected = model.actualProjects.find((project) => project.id === value);
  const selectedLabel = specialOption?.value === value ? specialOption.label : selected?.name || placeholder;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setQuery('');
  };

  const labels = isAr ? {
    all: 'الكل', standalone: 'مستقلة', folders: 'داخل مجلدات', search: 'ابحث عن مشروع...',
    standaloneTitle: 'مشاريع مستقلة', foldersTitle: 'مشاريع داخل المجلدات', empty: 'لا توجد مشاريع مطابقة',
  } : {
    all: 'All', standalone: 'Standalone', folders: 'In folders', search: 'Search projects...',
    standaloneTitle: 'Standalone projects', foldersTitle: 'Projects inside folders', empty: 'No matching projects',
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${open ? 'z-[100]' : ''} ${className}`}>
      <button type="button" aria-label={ariaLabel || placeholder} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex h-full min-h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-start text-xs text-slate-700 outline-none transition hover:border-blue-300 focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600">
        <span className="flex min-w-0 items-center gap-2"><BriefcaseBusiness size={15} className="shrink-0 text-slate-400" /><span className={`truncate ${selected || specialOption?.value === value ? 'font-semibold' : 'text-slate-400'}`}>{selectedLabel}</span></span>
        <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute top-full z-[90] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_55px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900 ${isAr ? 'right-0' : 'left-0'}`}>
          <div className="relative mb-2"><Search size={14} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-slate-400" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pe-9 text-xs outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:focus:bg-slate-950" /></div>
          <div className="mb-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {(['all', 'standalone', 'folders'] as PickerFilter[]).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-lg px-2 py-1.5 text-[11px] font-bold transition ${filter === item ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>{labels[item]}</button>)}
          </div>
          <div role="listbox" className="max-h-72 space-y-1 overflow-y-auto overscroll-contain pe-1">
            {specialOption && filter === 'all' && !normalizedQuery && <button type="button" role="option" aria-selected={value === specialOption.value} onClick={() => choose(specialOption.value)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-start text-xs transition ${value === specialOption.value ? 'bg-blue-50 font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}><span>{specialOption.label}</span>{value === specialOption.value && <Check size={15} />}</button>}

            {visibleStandalone.length > 0 && <div><p className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{labels.standaloneTitle}</p>{visibleStandalone.map((project) => <button key={project.id} type="button" role="option" aria-selected={value === project.id} onClick={() => choose(project.id)} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start text-xs transition ${value === project.id ? 'bg-blue-50 font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}><span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color || '#64748b' }} /><span className="truncate">{project.name}</span></span>{value === project.id && <Check size={15} className="shrink-0" />}</button>)}</div>}

            {visibleGroups.length > 0 && <p className="px-3 pb-1 pt-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{labels.foldersTitle}</p>}
            {visibleGroups.map(({ folder, projects: folderProjects }) => <div key={folder.id} className="rounded-xl border border-slate-100 p-1 dark:border-slate-800"><div className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-extrabold text-slate-500 dark:text-slate-400"><Folder size={14} style={{ color: folder.color || '#8b5cf6' }} /><span className="truncate">{folder.name}</span><span className="ms-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] dark:bg-slate-800">{folderProjects.length}</span></div>{folderProjects.map((project) => <button key={project.id} type="button" role="option" aria-selected={value === project.id} onClick={() => choose(project.id)} className={`flex w-full items-center justify-between gap-3 rounded-lg py-2 pe-2 ps-7 text-start text-xs transition ${value === project.id ? 'bg-blue-50 font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}><span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color || folder.color || '#64748b' }} /><span className="truncate">{project.name}</span></span>{value === project.id && <Check size={15} className="shrink-0" />}</button>)}</div>)}

            {visibleStandalone.length === 0 && visibleGroups.length === 0 && !(specialOption && filter === 'all' && !normalizedQuery) && <p className="px-3 py-8 text-center text-xs text-slate-400">{labels.empty}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
