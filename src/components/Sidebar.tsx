'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useSyncExternalStore } from 'react';
import {
  BarChart3, Bell, BookOpen, CheckSquare, ChevronLeft, ChevronRight, Clock,
  FolderOpen, Globe, Home, LogOut, Menu, Moon, Settings, Star, Sun, Target,
  TrendingUp, Video, X,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import type { ActiveView } from '@/lib/types';
import { useShallow } from '@/lib/useAppShallow';

interface SidebarProps {
  onSignOut: () => void;
}

interface NavItem {
  id: ActiveView;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const subscribeToHydration = () => () => {};

export default function Sidebar({ onSignOut }: SidebarProps) {
  const {
    activeView, setActiveView, isSidebarOpen, toggleSidebar, setSidebarOpen,
    language, setLanguage, darkMode, toggleDarkMode,
  } = useAppStore(useShallow((state) => ({
    activeView: state.activeView,
    setActiveView: state.setActiveView,
    isSidebarOpen: state.isSidebarOpen,
    toggleSidebar: state.toggleSidebar,
    setSidebarOpen: state.setSidebarOpen,
    language: state.language,
    setLanguage: state.setLanguage,
    darkMode: state.darkMode,
    toggleDarkMode: state.toggleDarkMode,
  })));
  const t = useT();
  const isRTL = language !== 'en';
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  const groups: NavGroup[] = [
    {
      label: t('nav.groupProductivity'),
      items: [
        { id: 'dashboard', label: t('nav.dashboard'), icon: <Home size={18} /> },
        { id: 'projects', label: t('nav.projects'), icon: <FolderOpen size={18} /> },
        { id: 'tasks', label: t('nav.tasks'), icon: <CheckSquare size={18} /> },
        { id: 'sessions', label: t('nav.sessions'), icon: <Clock size={18} /> },
      ],
    },
    {
      label: t('nav.groupAnalysis'),
      items: [
        { id: 'analytics', label: t('nav.analytics'), icon: <BarChart3 size={18} /> },
        { id: 'charts', label: language === 'ar' ? 'الجراف' : 'Charts', icon: <TrendingUp size={18} /> },
        { id: 'goals', label: t('nav.goals'), icon: <Target size={18} /> },
      ],
    },
    {
      label: t('nav.groupContent'),
      items: [
        { id: 'library', label: t('nav.library'), icon: <BookOpen size={18} /> },
        { id: 'video', label: t('nav.video'), icon: <Video size={18} /> },
      ],
    },
    {
      label: t('nav.groupReligion'),
      items: [{ id: 'prayers', label: t('nav.prayers'), icon: <Star size={18} /> }],
    },
    {
      label: t('nav.groupMore'),
      items: [
        { id: 'notifications', label: t('nav.notifications'), icon: <Bell size={18} /> },
        { id: 'settings', label: t('nav.settings'), icon: <Settings size={18} /> },
      ],
    },
  ];

  const handleNavClick = (view: ActiveView) => {
    setActiveView(view);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const toggleLang = () => setLanguage(language === 'ar' ? 'en' : 'ar');
  const originalDashboardStyle = activeView === 'dashboard';
  const slideX = isSidebarOpen ? 0 : 300;
  const animX = isRTL ? slideX : -slideX;
  const closeIcon = isRTL ? <ChevronRight size={17} /> : <ChevronLeft size={17} />;

  if (!hydrated) return null;

  return (
    <>
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-[1px] dark:bg-black/55 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      <button onClick={toggleSidebar} className={`fixed top-4 z-[70] flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 md:hidden ${isRTL ? 'right-4' : 'left-4'}`} aria-label={isSidebarOpen ? t('nav.closeMenu') : t('nav.openMenu')}>
        {isSidebarOpen ? <X size={21} /> : <Menu size={21} />}
      </button>

      {!isSidebarOpen && (
        <button onClick={toggleSidebar} className={`fixed top-4 z-30 hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-md transition hover:text-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 md:flex ${isRTL ? 'right-4' : 'left-4'}`} aria-label={t('nav.openMenu')}>
          <Menu size={19} />
        </button>
      )}

      <motion.aside
        initial={false}
        animate={{ x: animX }}
        transition={{ type: 'spring', damping: 28, stiffness: 230 }}
        className={`fixed top-0 z-50 flex h-full w-64 flex-col border-slate-200/90 bg-white/95 shadow-[0_0_40px_rgba(15,23,42,0.045)] backdrop-blur-xl ${originalDashboardStyle ? 'dark:border-[#26334a] dark:bg-[#0d1422]/95' : 'dark:border-[#3a455c] dark:bg-[#293246]/95'} ${isRTL ? 'right-0 border-l' : 'left-0 border-r'}`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <div className={`relative flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-black text-white ${originalDashboardStyle ? 'bg-gradient-to-br from-blue-500 via-violet-600 to-fuchsia-500 shadow-lg shadow-violet-500/20' : 'bg-violet-600'}`}>
              س
              <span className="absolute -bottom-1 -end-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white">{t('nav.sabeel')}</h1>
              <p className={`mt-0.5 ${originalDashboardStyle ? 'text-[10px] text-slate-400 dark:text-slate-500' : 'text-[11px] text-slate-500 dark:text-slate-400'}`}>{t('nav.sabeelDesc')}</p>
            </div>
          </div>
          <button onClick={toggleSidebar} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label={t('nav.closeMenu')}>
            {closeIcon}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3 [scrollbar-width:thin]">
          {groups.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex === 0 ? '' : 'mt-3 border-t border-slate-100 pt-3 dark:border-slate-800'}>
              <p className={`mb-1.5 px-3 font-bold ${originalDashboardStyle ? 'text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500' : 'text-[11px] text-slate-500 dark:text-slate-400'}`}>{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = activeView === item.id;
                  return (
                    <button key={item.id} onClick={() => handleNavClick(item.id)} aria-current={active ? 'page' : undefined} className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${originalDashboardStyle ? '' : 'min-h-10'} ${active ? (originalDashboardStyle ? 'bg-gradient-to-r from-violet-100 to-blue-50 text-violet-700 shadow-sm dark:from-violet-950/70 dark:to-blue-950/45 dark:text-violet-200' : 'bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-200') : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`}>
                      {active && <span className={`absolute inset-y-2 w-1 rounded-full bg-violet-600 ${isRTL ? 'right-0' : 'left-0'}`} />}
                      <span className={originalDashboardStyle ? `transition-colors ${active ? 'text-violet-600 dark:text-violet-300' : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'}` : `grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${active ? 'bg-white text-violet-600 shadow-sm dark:bg-violet-900/60 dark:text-violet-200' : 'bg-slate-50 text-slate-500 group-hover:bg-white group-hover:text-violet-600 dark:bg-slate-700/45 dark:text-slate-400 dark:group-hover:bg-slate-700 dark:group-hover:text-violet-300'}`}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
          <button onClick={toggleDarkMode} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
            {darkMode ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-slate-400" />}
            <span>{darkMode ? (language === 'ar' ? 'الوضع الفاتح' : 'Light Mode') : (language === 'ar' ? 'الوضع الداكن' : 'Dark Mode')}</span>
          </button>
          <button onClick={toggleLang} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
            <Globe size={18} className="text-slate-400" />
            <span>{language === 'ar' ? 'English' : 'العربية'}</span>
            <span className={`${isRTL ? 'mr-auto' : 'ml-auto'} rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400`}>{language === 'ar' ? 'AR' : 'EN'}</span>
          </button>
          <button onClick={onSignOut} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/35">
            <LogOut size={18} />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </motion.aside>
    </>
  );
}
