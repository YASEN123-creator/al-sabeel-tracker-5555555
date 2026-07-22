import { create } from 'zustand';
import type { Project, Task, Session, Goal, UserSettings, ActiveView, TimerState, Toast, DeletedProject, LibraryResource, VideoItem, AppNotification, PrayerLog, QuickCreate } from './types';
import type { Lang } from './i18n';
import { isArrayValue, isRecordValue, readStorageText, safeParseJsonResult, writeStorageJson, writeStorageText } from './storage';

const LOCAL_KEYS = {
  trash: 'sabeel_trash',
  ratings: 'sabeel_ratings',
  library: 'sabeel_library',
  videos: 'sabeel_videos',
  notifications: 'sabeel_notifications',
  projectPlans: 'sabeel_project_plans',
  sessionPlans: 'sabeel_session_plans',
} as const;

export function withoutTrashedProjects(projects: Project[], trash: DeletedProject[]): Project[] {
  const hiddenIds = new Set(trash.map((item) => item.project.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const project of projects) {
      if (!hiddenIds.has(project.id) && project.parent_id && hiddenIds.has(project.parent_id)) {
        hiddenIds.add(project.id);
        changed = true;
      }
    }
  }
  return projects.filter((project) => !hiddenIds.has(project.id));
}

function localOwnerKey(key: string): string {
  return `${key}:owner`;
}

function scopedStorageKey(key: string, userId: string): string {
  return `${key}:${userId}`;
}

function persistUserLocalValue(key: string, userId: string | null, value: unknown, mirrorLegacy = true): boolean {
  if (!userId) return false;
  const saved = writeStorageJson(scopedStorageKey(key, userId), value);
  if (mirrorLegacy) mirrorLegacyValue(key, userId, value);
  return saved;
}

function mirrorLegacyValue(key: string, userId: string, value: unknown): void {
  // Compatibility mirror for the current backup implementation.
  writeStorageJson(key, value);
  writeStorageText(localOwnerKey(key), userId);
}

interface LoadedLocalValue<T> {
  value: T;
  mirrorLegacy: boolean;
}

function loadUserLocalValue<T>(key: string, userId: string, fallback: T, validator: (value: unknown) => boolean): LoadedLocalValue<T> {
  if (typeof window === 'undefined') return { value: fallback, mirrorLegacy: false };

  try {
    const scopedKey = scopedStorageKey(key, userId);
    const scopedRaw = localStorage.getItem(scopedKey);
    if (scopedRaw !== null) {
      return { value: safeParseJsonResult(scopedRaw, fallback, validator).value, mirrorLegacy: true };
    }

    // Claim unscoped legacy data once, for the first authenticated user after
    // this storage model is introduced. A corrupt value is left untouched.
    const legacyOwner = localStorage.getItem(localOwnerKey(key));
    if (!legacyOwner || legacyOwner === userId) {
      const legacyRaw = localStorage.getItem(key);
      const parsed = safeParseJsonResult(legacyRaw, fallback, validator);
      if (parsed.valid) writeStorageJson(scopedKey, parsed.value);
      return { value: parsed.value, mirrorLegacy: legacyRaw === null || parsed.valid };
    }
  } catch {
    return { value: fallback, mirrorLegacy: false };
  }

  return { value: fallback, mirrorLegacy: true };
}

function loadLocalStateForUser(userId: string) {
  const trash = loadUserLocalValue<DeletedProject[]>(LOCAL_KEYS.trash, userId, [], isArrayValue);
  const ratings = loadUserLocalValue<Record<string, number>>(LOCAL_KEYS.ratings, userId, {}, isRecordValue);
  const library = loadUserLocalValue<LibraryResource[]>(LOCAL_KEYS.library, userId, [], isArrayValue);
  const videos = loadUserLocalValue<VideoItem[]>(LOCAL_KEYS.videos, userId, [], isArrayValue);
  const storedNotifications = loadUserLocalValue<AppNotification[]>(LOCAL_KEYS.notifications, userId, [], isArrayValue);
  const projectPlans = loadUserLocalValue<Record<string, number>>(LOCAL_KEYS.projectPlans, userId, {}, isRecordValue);
  const sessionPlans = loadUserLocalValue<Record<string, number>>(LOCAL_KEYS.sessionPlans, userId, {}, isRecordValue);
  const state = {
    deletedProjects: trash.value,
    projectRatings: ratings.value,
    libraryResources: library.value,
    videoItems: videos.value,
    notifications: storedNotifications.value,
    projectPlans: projectPlans.value,
    sessionPlans: sessionPlans.value,
  };

  // Keep legacy keys as an active-user mirror so existing backup/export code
  // continues to read the correct account's local-only data.
  // Only mirror the resolved value to legacy keys here. In particular, do not
  // overwrite a corrupt scoped value while falling back safely in memory.
  if (trash.mirrorLegacy) mirrorLegacyValue(LOCAL_KEYS.trash, userId, state.deletedProjects);
  if (ratings.mirrorLegacy) mirrorLegacyValue(LOCAL_KEYS.ratings, userId, state.projectRatings);
  if (library.mirrorLegacy) mirrorLegacyValue(LOCAL_KEYS.library, userId, state.libraryResources);
  if (videos.mirrorLegacy) mirrorLegacyValue(LOCAL_KEYS.videos, userId, state.videoItems);
  if (storedNotifications.mirrorLegacy) mirrorLegacyValue(LOCAL_KEYS.notifications, userId, state.notifications);
  if (projectPlans.mirrorLegacy) mirrorLegacyValue(LOCAL_KEYS.projectPlans, userId, state.projectPlans);
  if (sessionPlans.mirrorLegacy) mirrorLegacyValue(LOCAL_KEYS.sessionPlans, userId, state.sessionPlans);
  return state;
}

const emptyUserState = {
  projects: [] as Project[],
  tasks: [] as Task[],
  sessions: [] as Session[],
  goals: [] as Goal[],
  settings: null as UserSettings | null,
  prayerLogs: [] as PrayerLog[],
  deletedProjects: [] as DeletedProject[],
  projectRatings: {} as Record<string, number>,
  libraryResources: [] as LibraryResource[],
  videoItems: [] as VideoItem[],
  notifications: [] as AppNotification[],
  projectPlans: {} as Record<string, number>,
  sessionPlans: {} as Record<string, number>,
};

export interface AppState {
  userId: string | null;
  setUserId: (id: string | null) => void;

  userEmail: string | null;
  setUserEmail: (email: string | null) => void;
  switchUser: (id: string | null, email: string | null) => void;

  language: Lang;
  setLanguage: (lang: Lang) => void;

  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  pendingCreate: QuickCreate | null;
  setPendingCreate: (value: QuickCreate | null) => void;

  dataLoading: boolean;
  setDataLoading: (loading: boolean) => void;

  projects: Project[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  removeProject: (id: string) => void;

  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (task: Task) => void;
  removeTask: (id: string) => void;

  sessions: Session[];
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (session: Session) => void;
  removeSession: (id: string) => void;

  projectPlans: Record<string, number>;
  setProjectPlan: (projectId: string, minutes: number) => boolean;
  sessionPlans: Record<string, number>;
  setSessionPlan: (sessionId: string, minutes: number) => boolean;

  goals: Goal[];
  setGoals: (goals: Goal[]) => void;
  addGoal: (goal: Goal) => void;
  updateGoal: (goal: Goal) => void;
  removeGoal: (id: string) => void;

  settings: UserSettings | null;
  setSettings: (settings: UserSettings) => void;

  timerState: TimerState;
  setTimerState: (state: TimerState) => void;
  timerSeconds: number;
  setTimerSeconds: (seconds: number) => void;
  timerStartedAt: number | null;
  setTimerStartedAt: (t: number | null) => void;
  timerTotalAtStart: number;
  setTimerTotalAtStart: (t: number) => void;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;

  startTimer: (() => void) | null;
  setStartTimer: (fn: (() => void) | null) => void;
  pauseTimer: (() => void) | null;
  setPauseTimer: (fn: (() => void) | null) => void;
  resumeTimer: (() => void) | null;
  setResumeTimer: (fn: (() => void) | null) => void;
  skipTimer: (() => void) | null;
  setSkipTimer: (fn: (() => void) | null) => void;
  resetTimer: (() => void) | null;
  setResetTimer: (fn: (() => void) | null) => void;

  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  toasts: Toast[];
  addToast: (message: string, type: 'success' | 'error' | 'info', options?: { actionLabel?: string; onAction?: () => void; duration?: number }) => void;
  removeToast: (id: string) => void;

  darkMode: boolean;
  toggleDarkMode: () => void;

  deletedProjects: DeletedProject[];
  moveToTrash: (project: Project) => boolean;
  restoreFromTrash: (projectId: string) => boolean;
  removeTrashProjects: (projectIds: string[]) => boolean;
  restoreBrowserData: (data: {
    deletedProjects: DeletedProject[];
    projectRatings: Record<string, number>;
    projectPlans?: Record<string, number>;
    sessionPlans?: Record<string, number>;
    libraryResources: LibraryResource[];
    videoItems: VideoItem[];
    notifications: AppNotification[];
  }, mode: 'replace' | 'merge') => string[];

  projectRatings: Record<string, number>;
  setProjectRating: (projectId: string, rating: number) => void;

  libraryResources: LibraryResource[];
  addLibraryResource: (resource: LibraryResource) => void;
  updateLibraryResource: (resource: LibraryResource) => void;
  removeLibraryResource: (id: string) => void;

  videoItems: VideoItem[];
  addVideoItem: (video: VideoItem) => void;
  updateVideoItem: (video: VideoItem) => void;
  removeVideoItem: (id: string) => void;

  notifications: AppNotification[];
  addNotification: (notification: AppNotification) => void;
  markNotificationRead: (id: string) => void;
  removeNotification: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  unreadCount: () => number;

  prayerLogs: PrayerLog[];
  setPrayerLogs: (logs: PrayerLog[]) => void;
  addPrayerLog: (log: PrayerLog) => void;
  updatePrayerLog: (log: PrayerLog) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userId: null,
  setUserId: (userId) => set({ userId }),

  userEmail: null,
  setUserEmail: (userEmail) => set({ userEmail }),
  switchUser: (userId, userEmail) => set({
    ...emptyUserState,
    ...(userId ? loadLocalStateForUser(userId) : {}),
    userId,
    userEmail,
    dataLoading: Boolean(userId),
    timerState: 'idle',
    timerSeconds: 25 * 60,
    timerStartedAt: null,
    timerTotalAtStart: 25 * 60,
    activeProjectId: null,
    activeTaskId: null,
    pendingCreate: null,
    toasts: [],
  }),

  language: readStorageText('sabeel_lang', 'ar', (value) => value === 'ar' || value === 'en') as Lang,
  setLanguage: (language) => {
    writeStorageText('sabeel_lang', language);
    set({ language });
  },

  activeView: 'dashboard',
  setActiveView: (view) => set({ activeView: view }),
  pendingCreate: null,
  setPendingCreate: (pendingCreate) => set({ pendingCreate }),

  dataLoading: true,
  setDataLoading: (dataLoading) => set({ dataLoading }),

  projects: [],
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
  updateProject: (project) => set((s) => ({ projects: s.projects.map((p) => (p.id === project.id ? project : p)) })),
  removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTask: (task) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === task.id ? task : t)) })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  sessions: [],
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((s) => ({ sessions: [...s.sessions, session] })),
  updateSession: (session) => set((s) => ({ sessions: s.sessions.map((se) => (se.id === session.id ? session : se)) })),
  removeSession: (id) => set((s) => ({ sessions: s.sessions.filter((se) => se.id !== id) })),

  projectPlans: {},
  setProjectPlan: (projectId, minutes) => {
    let saved = false;
    set((s) => {
      const updated = { ...s.projectPlans };
      if (minutes > 0) updated[projectId] = Math.round(minutes);
      else delete updated[projectId];
      saved = persistUserLocalValue(LOCAL_KEYS.projectPlans, s.userId, updated);
      return saved ? { projectPlans: updated } : s;
    });
    return saved;
  },
  sessionPlans: {},
  setSessionPlan: (sessionId, minutes) => {
    let saved = false;
    set((s) => {
      const updated = { ...s.sessionPlans };
      if (minutes > 0) updated[sessionId] = Math.round(minutes);
      else delete updated[sessionId];
      saved = persistUserLocalValue(LOCAL_KEYS.sessionPlans, s.userId, updated);
      return saved ? { sessionPlans: updated } : s;
    });
    return saved;
  },

  goals: [],
  setGoals: (goals) => set({ goals }),
  addGoal: (goal) => set((s) => ({ goals: [...s.goals, goal] })),
  updateGoal: (goal) => set((s) => ({ goals: s.goals.map((g) => (g.id === goal.id ? goal : g)) })),
  removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

  settings: null,
  setSettings: (settings) => set({ settings }),

  timerState: 'idle',
  setTimerState: (timerState) => set({ timerState }),
  timerSeconds: 25 * 60,
  setTimerSeconds: (timerSeconds) => set({ timerSeconds }),
  timerStartedAt: null,
  setTimerStartedAt: (timerStartedAt) => set({ timerStartedAt }),
  timerTotalAtStart: 25 * 60,
  setTimerTotalAtStart: (timerTotalAtStart) => set({ timerTotalAtStart }),
  activeProjectId: null,
  setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
  activeTaskId: null,
  setActiveTaskId: (activeTaskId) => set({ activeTaskId }),

  startTimer: null,
  setStartTimer: (fn) => set({ startTimer: fn }),
  pauseTimer: null,
  setPauseTimer: (fn) => set({ pauseTimer: fn }),
  resumeTimer: null,
  setResumeTimer: (fn) => set({ resumeTimer: fn }),
  skipTimer: null,
  setSkipTimer: (fn) => set({ skipTimer: fn }),
  resetTimer: null,
  setResetTimer: (fn) => set({ resetTimer: fn }),

  // Default sidebar state: open on desktop, closed on mobile
  isSidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

  toasts: [],
  addToast: (message, type, options) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, type, actionLabel: options?.actionLabel, onAction: options?.onAction }] }));
    setTimeout(() => {
      useAppStore.getState().removeToast(id);
    }, options?.duration ?? (options?.onAction ? 6500 : 3000));
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  darkMode: readStorageText('sabeel_dark', 'false', (value) => value === 'true' || value === 'false') === 'true',
  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode;
    writeStorageText('sabeel_dark', String(next));
    return { darkMode: next };
  }),

  deletedProjects: [],
  moveToTrash: (project) => {
    const deletedItem: DeletedProject = { project, deletedAt: new Date().toISOString() };
    let saved = false;
    set((s) => {
      if (s.deletedProjects.some((item) => item.project.id === project.id)) return s;
      const updated = [...s.deletedProjects, deletedItem];
      saved = persistUserLocalValue(LOCAL_KEYS.trash, s.userId, updated);
      return saved ? { deletedProjects: updated, projects: withoutTrashedProjects(s.projects, updated) } : s;
    });
    return saved;
  },
  restoreFromTrash: (projectId) => {
    let saved = false;
    set((s) => {
      const item = s.deletedProjects.find((d) => d.project.id === projectId);
      if (!item) return s;
      const updated = s.deletedProjects.filter((d) => d.project.id !== projectId);
      saved = persistUserLocalValue(LOCAL_KEYS.trash, s.userId, updated);
      return saved ? { deletedProjects: updated, projects: [item.project, ...s.projects] } : s;
    });
    return saved;
  },
  removeTrashProjects: (projectIds) => {
    let saved = false;
    const ids = new Set(projectIds);
    set((s) => {
      const updated = s.deletedProjects.filter((item) => !ids.has(item.project.id));
      saved = persistUserLocalValue(LOCAL_KEYS.trash, s.userId, updated);
      return saved ? { deletedProjects: updated } : s;
    });
    return saved;
  },
  restoreBrowserData: (data, mode) => {
    const failed: string[] = [];
    set((s) => {
      if (!s.userId) return s;
      const mergeById = <T extends { id: string }>(current: T[], incoming: T[]) => {
        if (mode === 'replace') return incoming;
        const records = new Map(current.map((record) => [record.id, record]));
        incoming.forEach((record) => records.set(record.id, record));
        return Array.from(records.values());
      };
      const trash = mode === 'replace'
        ? data.deletedProjects
        : Array.from(new Map([...s.deletedProjects, ...data.deletedProjects].map((item) => [item.project.id, item])).values());
      const next = {
        deletedProjects: trash,
        projectRatings: mode === 'replace' ? data.projectRatings : { ...s.projectRatings, ...data.projectRatings },
        projectPlans: mode === 'replace' ? (data.projectPlans || {}) : { ...s.projectPlans, ...(data.projectPlans || {}) },
        sessionPlans: mode === 'replace' ? (data.sessionPlans || {}) : { ...s.sessionPlans, ...(data.sessionPlans || {}) },
        libraryResources: mergeById(s.libraryResources, data.libraryResources),
        videoItems: mergeById(s.videoItems, data.videoItems),
        notifications: mergeById(s.notifications, data.notifications).slice(0, 50),
      };
      const writes: Array<[string, unknown]> = [
        [LOCAL_KEYS.trash, next.deletedProjects], [LOCAL_KEYS.ratings, next.projectRatings],
        [LOCAL_KEYS.library, next.libraryResources], [LOCAL_KEYS.videos, next.videoItems],
        [LOCAL_KEYS.notifications, next.notifications], [LOCAL_KEYS.projectPlans, next.projectPlans],
        [LOCAL_KEYS.sessionPlans, next.sessionPlans],
      ];
      for (const [key, value] of writes) {
        if (!persistUserLocalValue(key, s.userId, value, false)) failed.push(key);
      }
      return failed.length === 0 ? next : s;
    });
    return failed;
  },

  projectRatings: {},
  setProjectRating: (projectId, rating) => {
    set((s) => {
      const updated = { ...s.projectRatings, [projectId]: rating };
      persistUserLocalValue(LOCAL_KEYS.ratings, s.userId, updated);
      return { projectRatings: updated };
    });
  },

  libraryResources: [],
  addLibraryResource: (resource) => {
    set((s) => {
      const updated = [...s.libraryResources, resource];
      persistUserLocalValue(LOCAL_KEYS.library, s.userId, updated);
      return { libraryResources: updated };
    });
  },
  updateLibraryResource: (resource) => {
    set((s) => {
      const updated = s.libraryResources.map((r) => (r.id === resource.id ? resource : r));
      persistUserLocalValue(LOCAL_KEYS.library, s.userId, updated);
      return { libraryResources: updated };
    });
  },
  removeLibraryResource: (id) => {
    set((s) => {
      const updated = s.libraryResources.filter((r) => r.id !== id);
      persistUserLocalValue(LOCAL_KEYS.library, s.userId, updated);
      return { libraryResources: updated };
    });
  },

  videoItems: [],
  addVideoItem: (video) => {
    set((s) => {
      const updated = [...s.videoItems, video];
      persistUserLocalValue(LOCAL_KEYS.videos, s.userId, updated);
      return { videoItems: updated };
    });
  },
  updateVideoItem: (video) => {
    set((s) => {
      const updated = s.videoItems.map((v) => (v.id === video.id ? video : v));
      persistUserLocalValue(LOCAL_KEYS.videos, s.userId, updated);
      return { videoItems: updated };
    });
  },
  removeVideoItem: (id) => {
    set((s) => {
      const updated = s.videoItems.filter((v) => v.id !== id);
      persistUserLocalValue(LOCAL_KEYS.videos, s.userId, updated);
      return { videoItems: updated };
    });
  },

  notifications: [],
  addNotification: (notification) => {
    set((s) => {
      const updated = [notification, ...s.notifications].slice(0, 50);
      persistUserLocalValue(LOCAL_KEYS.notifications, s.userId, updated);
      return { notifications: updated };
    });
  },
  markNotificationRead: (id) => {
    set((s) => {
      const updated = s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      persistUserLocalValue(LOCAL_KEYS.notifications, s.userId, updated);
      return { notifications: updated };
    });
  },
  removeNotification: (id) => {
    set((s) => {
      const updated = s.notifications.filter((notification) => notification.id !== id);
      persistUserLocalValue(LOCAL_KEYS.notifications, s.userId, updated);
      return { notifications: updated };
    });
  },
  markAllNotificationsRead: () => {
    set((s) => {
      const updated = s.notifications.map((n) => ({ ...n, read: true }));
      persistUserLocalValue(LOCAL_KEYS.notifications, s.userId, updated);
      return { notifications: updated };
    });
  },
  clearNotifications: () => {
    set((s) => {
      persistUserLocalValue(LOCAL_KEYS.notifications, s.userId, []);
      return { notifications: [] };
    });
  },
  unreadCount: () => {
    return useAppStore.getState().notifications.filter((n) => !n.read).length;
  },

  prayerLogs: [],
  setPrayerLogs: (prayerLogs) => set({ prayerLogs }),
  addPrayerLog: (log) => set((s) => ({ prayerLogs: [...s.prayerLogs, log] })),
  updatePrayerLog: (log) => set((s) => ({
    prayerLogs: s.prayerLogs.map((l) => (l.id === log.id ? log : l)),
  })),
}));
