import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project, Task, Session, Goal, UserSettings, PrayerLog, PrayerLogPayload, PrayerStatus } from './types';
import type { ImportMode, SabeelBackupData } from './backup';
import { isArrayValue, isRecordValue, safeParseJsonResult, writeStorageJson, writeStorageText } from './storage';
import { isSupabaseConfigured as hasSupabaseConfig } from './supabaseConfig';

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return hasSupabaseConfig(url, key);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ==================== LocalStorage Helpers (Offline Mode) ====================
function scopedLocalKey(key: string, userId: string): string {
  return `${key}:${userId}`;
}

function getLocalValue<T>(key: string, userId: string, fallback: T, validator: (value: unknown) => boolean): T {
  try {
    const scopedKey = scopedLocalKey(key, userId);
    const scopedRaw = localStorage.getItem(scopedKey);
    let value = fallback;
    let mirrorLegacy = true;

    if (scopedRaw !== null) {
      value = safeParseJsonResult(scopedRaw, fallback, validator).value;
    } else {
      const ownerKey = `${key}:owner`;
      const legacyOwner = localStorage.getItem(ownerKey);
      if (!legacyOwner || legacyOwner === userId) {
        const legacyRaw = localStorage.getItem(key);
        const parsed = safeParseJsonResult(legacyRaw, fallback, validator);
        value = parsed.value;
        mirrorLegacy = legacyRaw === null || parsed.valid;
        if (parsed.valid) writeStorageJson(scopedKey, value);
      }
    }

    // Legacy keys remain an active-user mirror for backup compatibility. This
    // never replaces a corrupt scoped value used only as a safe fallback.
    if (mirrorLegacy) {
      writeStorageJson(key, value);
      writeStorageText(`${key}:owner`, userId);
    }
    return value;
  } catch {
    return fallback;
  }
}

function getLocalData<T>(key: string, userId: string): T[] {
  return getLocalValue<T[]>(key, userId, [], isArrayValue);
}

function setLocalData<T>(key: string, userId: string, data: T[]): void {
  const saved = writeStorageJson(scopedLocalKey(key, userId), data);
  writeStorageJson(key, data);
  writeStorageText(`${key}:owner`, userId);
  if (!saved) throw new Error('تعذر حفظ البيانات محلياً. تحقق من مساحة التخزين المتاحة.');
}

function getLocalSingle<T>(key: string, userId: string): T | null {
  return getLocalValue<T | null>(key, userId, null, (value) => value === null || isRecordValue(value));
}

function setLocalSingle<T>(key: string, userId: string, value: T): void {
  const saved = writeStorageJson(scopedLocalKey(key, userId), value);
  writeStorageJson(key, value);
  writeStorageText(`${key}:owner`, userId);
  if (!saved) throw new Error('تعذر حفظ الإعدادات محلياً. تحقق من مساحة التخزين المتاحة.');
}

// ==================== Online Mode: Supabase with Retry ====================
let supabaseInstance: SupabaseClient | null = null;

async function getSupabase(): Promise<SupabaseClient> {
  if (supabaseInstance) return supabaseInstance;
  const mod = await import('@/lib/supabase');
  supabaseInstance = mod.supabase;
  return supabaseInstance;
}

class RateLimitError extends Error {
  constructor(message: string, public retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const error = err as { message?: string; status?: number; code?: string };
      const isRateLimited = error?.status === 429 ||
        error?.message?.includes('rate limit') ||
        error?.message?.includes('Too many requests') ||
        error?.code === '429';

      if (isRateLimited && attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 8000);
        console.warn(`Rate limited. Retrying in ${waitTime}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(waitTime);
        continue;
      }

      if (isRateLimited) {
        throw new RateLimitError('تم تجاوز الحد المسموح من الطلبات. حاول بعد قليل.', 10);
      }

      throw err;
    }
  }
  throw new Error('فشل بعد عدة محاولات');
}

const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30_000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() });
}

function clearCache() {
  cache.clear();
}

function isValidUserId(userId: string | null | undefined): boolean {
  return !!(userId && userId.length > 10 && userId.includes('-'));
}

// ==================== Projects ====================
export async function fetchProjects(userId: string): Promise<Project[]> {
  if (!isValidUserId(userId)) return [];

  if (!isSupabaseConfigured()) {
    return getLocalData<Project>('sabeel_projects', userId);
  }

  const cacheKey = `projects_${userId}`;
  const cached = getCached<Project[]>(cacheKey);
  if (cached) return cached;

  return withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const result = data || [];
    setCache(cacheKey, result);
    return result;
  });
}

export async function fetchProjectsFresh(userId: string): Promise<Project[]> {
  cache.delete(`projects_${userId}`);
  return fetchProjects(userId);
}

export async function createProject(userId: string, project: { name: string; description?: string; color?: string; is_folder?: boolean; parent_id?: string | null }): Promise<Project> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString();
    const newProject: Project = {
      id: generateUUID(),
      user_id: userId,
      name: project.name,
      description: project.description || null,
      color: project.color || null,
      is_folder: project.is_folder || false,
      parent_id: project.parent_id || null,
      created_at: now,
      updated_at: now,
    };
    const all = getLocalData<Project>('sabeel_projects', userId);
    all.unshift(newProject);
    setLocalData('sabeel_projects', userId, all);
    return newProject;
  }

  const result = await withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: userId, ...project })
      .select()
      .single();
    if (error) throw error;
    return data;
  });
  clearCache();
  return result;
}

export async function updateProject(id: string, userId: string, updates: Partial<Project>): Promise<Project> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const all = getLocalData<Project>('sabeel_projects', userId);
    const idx = all.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('لم يتم العثور على المشروع');
    all[idx] = { ...all[idx], ...updates, updated_at: new Date().toISOString() };
    setLocalData('sabeel_projects', userId, all);
    return all[idx];
  }

  const result = await withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('لم يتم العثور على المشروع أو ليس ملكك');
    return data;
  });
  clearCache();
  return result;
}

export async function deleteProject(id: string, userId: string): Promise<void> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const all = getLocalData<Project>('sabeel_projects', userId);
    const idsToDelete = new Set([id]);
    let foundChild = true;
    while (foundChild) {
      foundChild = false;
      for (const project of all) {
        if (!idsToDelete.has(project.id) && project.parent_id && idsToDelete.has(project.parent_id)) {
          idsToDelete.add(project.id);
          foundChild = true;
        }
      }
    }
    const filtered = all.filter(p => !idsToDelete.has(p.id));
    setLocalData('sabeel_projects', userId, filtered);
    const tasks = getLocalData<Task>('sabeel_tasks', userId).map((task) =>
      task.project_id && idsToDelete.has(task.project_id) ? { ...task, project_id: null } : task,
    );
    const sessions = getLocalData<Session>('sabeel_sessions', userId).map((session) =>
      session.project_id && idsToDelete.has(session.project_id) ? { ...session, project_id: null } : session,
    );
    const goals = getLocalData<Goal>('sabeel_goals', userId).map((goal) =>
      goal.project_id && idsToDelete.has(goal.project_id) ? { ...goal, project_id: null } : goal,
    );
    setLocalData('sabeel_tasks', userId, tasks);
    setLocalData('sabeel_sessions', userId, sessions);
    setLocalData('sabeel_goals', userId, goals);
    return;
  }

  await withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('projects').delete().eq('id', id).eq('user_id', userId).select('id');
    if (error) throw error;
    // Idempotent deletion lets a trash entry be cleaned up safely after a
    // previous server delete succeeded but local persistence was interrupted.
    if (!data || data.length === 0) return;
  });
  clearCache();
}

// ==================== Tasks ====================
export async function fetchTasks(userId: string): Promise<Task[]> {
  if (!isValidUserId(userId)) return [];

  if (!isSupabaseConfigured()) {
    return getLocalData<Task>('sabeel_tasks', userId);
  }

  const cacheKey = `tasks_${userId}`;
  const cached = getCached<Task[]>(cacheKey);
  if (cached) return cached;

  return withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const result = data || [];
    setCache(cacheKey, result);
    return result;
  });
}

export async function createTask(userId: string, task: { title: string; description?: string | null; project_id?: string | null; due_date?: string | null; is_recurring?: boolean; recurring_days?: number[] | null }): Promise<Task> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString();
    const newTask: Task = {
      id: generateUUID(),
      user_id: userId,
      title: task.title,
      description: task.description || null,
      project_id: task.project_id || null,
      due_date: task.due_date || null,
      is_completed: false,
      is_recurring: task.is_recurring || false,
      recurring_days: task.recurring_days || null,
      created_at: now,
      updated_at: now,
    };
    const all = getLocalData<Task>('sabeel_tasks', userId);
    all.unshift(newTask);
    setLocalData('sabeel_tasks', userId, all);
    return newTask;
  }

  const result = await withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('tasks')
      .insert({ user_id: userId, ...task })
      .select()
      .single();
    if (error) throw error;
    return data;
  });
  clearCache();
  return result;
}

export async function updateTask(id: string, userId: string, updates: Partial<Omit<Task, 'id' | 'user_id' | 'created_at'>>): Promise<Task> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const all = getLocalData<Task>('sabeel_tasks', userId);
    const idx = all.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('لم يتم العثور على المهمة');
    all[idx] = { ...all[idx], ...updates, updated_at: new Date().toISOString() };
    setLocalData('sabeel_tasks', userId, all);
    return all[idx];
  }

  const result = await withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('لم يتم العثور على المهمة أو ليست ملكك');
    return data;
  });
  clearCache();
  return result;
}

export async function deleteTask(id: string, userId: string): Promise<void> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const all = getLocalData<Task>('sabeel_tasks', userId);
    const filtered = all.filter(t => t.id !== id);
    setLocalData('sabeel_tasks', userId, filtered);
    return;
  }

  await withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId).select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('لم يتم العثور على المهمة أو ليست ملكك');
  });
  clearCache();
}

// ==================== Sessions ====================
export async function fetchSessions(userId: string): Promise<Session[]> {
  if (!isValidUserId(userId)) return [];

  if (!isSupabaseConfigured()) {
    return getLocalData<Session>('sabeel_sessions', userId);
  }

  const cacheKey = `sessions_${userId}`;
  const cached = getCached<Session[]>(cacheKey);
  if (cached) return cached;

  return withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('session_date', { ascending: false });
    if (error) throw error;
    const result = data || [];
    setCache(cacheKey, result);
    return result;
  });
}

export async function createSession(userId: string, session: { project_id?: string | null; task_id?: string | null; start_time: string; end_time?: string | null; duration: number; session_date: string }): Promise<Session> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString();
    const newSession: Session = {
      id: generateUUID(),
      user_id: userId,
      project_id: session.project_id || null,
      task_id: session.task_id || null,
      start_time: session.start_time,
      end_time: session.end_time || null,
      duration: session.duration,
      session_date: session.session_date,
      created_at: now,
      updated_at: now,
    };
    const all = getLocalData<Session>('sabeel_sessions', userId);
    all.unshift(newSession);
    setLocalData('sabeel_sessions', userId, all);
    return newSession;
  }

  const result = await withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('sessions')
      .insert({ user_id: userId, ...session })
      .select()
      .single();
    if (error) throw error;
    return data;
  });
  clearCache();
  return result;
}

export async function updateSession(id: string, userId: string, updates: Partial<Session>): Promise<Session> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const all = getLocalData<Session>('sabeel_sessions', userId);
    const idx = all.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('لم يتم العثور على الجلسة');
    all[idx] = { ...all[idx], ...updates, updated_at: new Date().toISOString() };
    setLocalData('sabeel_sessions', userId, all);
    return all[idx];
  }

  const result = await withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('لم يتم العثور على الجلسة أو ليست ملكك');
    return data;
  });
  clearCache();
  return result;
}

export async function deleteSession(id: string, userId: string): Promise<void> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const all = getLocalData<Session>('sabeel_sessions', userId);
    const filtered = all.filter(s => s.id !== id);
    setLocalData('sabeel_sessions', userId, filtered);
    return;
  }

  await withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('sessions').delete().eq('id', id).eq('user_id', userId).select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('لم يتم العثور على الجلسة أو ليست ملكك');
  });
  clearCache();
}

// ==================== Goals ====================
export async function fetchGoals(userId: string): Promise<Goal[]> {
  if (!isValidUserId(userId)) return [];

  if (!isSupabaseConfigured()) {
    return getLocalData<Goal>('sabeel_goals', userId);
  }

  const cacheKey = `goals_${userId}`;
  const cached = getCached<Goal[]>(cacheKey);
  if (cached) return cached;

  return withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const result = data || [];
    setCache(cacheKey, result);
    return result;
  });
}

type GoalCreateInput = Pick<Goal, 'goal_type' | 'target_value'> & Partial<Pick<Goal, 'project_id' | 'goal_kind' | 'title' | 'description' | 'target_date' | 'is_completed'>>;

export async function createGoal(userId: string, goal: GoalCreateInput): Promise<Goal> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString();
    const newGoal: Goal = {
      id: generateUUID(),
      user_id: userId,
      project_id: goal.project_id || null,
      goal_type: goal.goal_type as Goal['goal_type'],
      target_value: goal.target_value,
      goal_kind: goal.goal_kind,
      title: goal.title,
      description: goal.description,
      target_date: goal.target_date,
      is_completed: goal.is_completed,
      created_at: now,
      updated_at: now,
    };
    const all = getLocalData<Goal>('sabeel_goals', userId);
    all.unshift(newGoal);
    setLocalData('sabeel_goals', userId, all);
    return newGoal;
  }

  const result = await withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('goals')
      .insert({ user_id: userId, ...goal })
      .select()
      .single();
    if (error) throw error;
    return data;
  });
  clearCache();
  return result;
}

export async function updateGoal(id: string, userId: string, updates: Partial<Goal>): Promise<Goal> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const all = getLocalData<Goal>('sabeel_goals', userId);
    const idx = all.findIndex(g => g.id === id);
    if (idx === -1) throw new Error('لم يتم العثور على الهدف');
    all[idx] = { ...all[idx], ...updates, updated_at: new Date().toISOString() };
    setLocalData('sabeel_goals', userId, all);
    return all[idx];
  }

  const result = await withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('لم يتم العثور على الهدف أو ليس ملكك');
    return data;
  });
  clearCache();
  return result;
}

export async function deleteGoal(id: string, userId: string): Promise<void> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const all = getLocalData<Goal>('sabeel_goals', userId);
    const filtered = all.filter(g => g.id !== id);
    setLocalData('sabeel_goals', userId, filtered);
    return;
  }

  await withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', userId).select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('لم يتم العثور على الهدف أو ليس ملكك');
  });
  clearCache();
}

// ==================== Settings ====================
export async function fetchSettings(userId: string): Promise<UserSettings | null> {
  if (!isValidUserId(userId)) return null;

  if (!isSupabaseConfigured()) {
    return getLocalSingle<UserSettings>('sabeel_settings', userId);
  }

  const cacheKey = `settings_${userId}`;
  const cached = getCached<UserSettings | null>(cacheKey);
  if (cached !== null) return cached;

  return withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') throw error;
    const result = data || null;
    if (result) setCache(cacheKey, result);
    return result;
  });
}

export async function upsertSettings(userId: string, settings: Partial<UserSettings>): Promise<UserSettings> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString();
    const existing = getLocalSingle<UserSettings>('sabeel_settings', userId);
    const newSettings: UserSettings = {
      id: existing?.id || generateUUID(),
      user_id: userId,
      enable_pomodoro: settings.enable_pomodoro ?? true,
      enable_goals: settings.enable_goals ?? true,
      enable_analytics: settings.enable_analytics ?? true,
      pomodoro_work_duration: settings.pomodoro_work_duration ?? 25,
      pomodoro_break_duration: settings.pomodoro_break_duration ?? 5,
      adhan_enabled: settings.adhan_enabled ?? true,
      alarm_sound: settings.alarm_sound ?? 'bell',
      custom_alarm_data: settings.custom_alarm_data ?? '',
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    setLocalSingle('sabeel_settings', userId, newSettings);
    return newSettings;
  }

  const result = await withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, ...settings }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  });
  clearCache();
  return result;
}

// ==================== Prayer Logs ====================
export async function fetchPrayerLogs(userId: string): Promise<PrayerLog[]> {
  if (!isValidUserId(userId)) return [];

  if (!isSupabaseConfigured()) {
    return getLocalData<PrayerLog>('sabeel_prayers', userId);
  }

  const cacheKey = `prayers_${userId}`;
  const cached = getCached<PrayerLog[]>(cacheKey);
  if (cached) return cached;

  return withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('prayer_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false });
    if (error) throw error;
    const result = data || [];
    setCache(cacheKey, result);
    return result;
  });
}

export async function upsertPrayerLog(userId: string, log: PrayerLogPayload): Promise<PrayerLog> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString();
    const all = getLocalData<PrayerLog>('sabeel_prayers', userId);
    const existing = all.find(l => l.log_date === log.log_date && l.user_id === userId);

    if (existing) {
      const updated: PrayerLog = {
        ...existing,
        ...log,
        fajr_status: log.fajr_status ?? existing.fajr_status ?? null,
        dhuhr_status: log.dhuhr_status ?? existing.dhuhr_status ?? null,
        asr_status: log.asr_status ?? existing.asr_status ?? null,
        maghrib_status: log.maghrib_status ?? existing.maghrib_status ?? null,
        isha_status: log.isha_status ?? existing.isha_status ?? null,
        quran_surahs: log.quran_surahs ?? existing.quran_surahs ?? [],
        custom_worships: log.custom_worships ?? existing.custom_worships ?? [],
        updated_at: now,
      };
      const idx = all.findIndex(l => l.id === existing.id);
      all[idx] = updated;
      setLocalData('sabeel_prayers', userId, all);
      return updated;
    }

    const newLog: PrayerLog = {
      id: generateUUID(),
      user_id: userId,
      ...log,
 fajr_status: (log.fajr_status as PrayerStatus) || null,
dhuhr_status: (log.dhuhr_status as PrayerStatus) || null,
asr_status: (log.asr_status as PrayerStatus) || null,
maghrib_status: (log.maghrib_status as PrayerStatus) || null,
isha_status: (log.isha_status as PrayerStatus) || null,
      quran_surahs: log.quran_surahs || [],
      custom_worships: log.custom_worships || [],
      created_at: now,
      updated_at: now,
    };
    all.unshift(newLog);
    setLocalData('sabeel_prayers', userId, all);
    return newLog;
  }

  const result = await withRetry(async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('prayer_logs')
      .upsert({
        user_id: userId,
        log_date: log.log_date,
        fajr: log.fajr,
        dhuhr: log.dhuhr,
        asr: log.asr,
        maghrib: log.maghrib,
        isha: log.isha,
        fajr_sunnah: log.fajr_sunnah,
        dhuhr_sunnah: log.dhuhr_sunnah,
        asr_sunnah: log.asr_sunnah,
        maghrib_sunnah: log.maghrib_sunnah,
        isha_sunnah: log.isha_sunnah,
        quran_pages: log.quran_pages,
        quran_notes: log.quran_notes,
        fajr_status: log.fajr_status || null,
        dhuhr_status: log.dhuhr_status || null,
        asr_status: log.asr_status || null,
        maghrib_status: log.maghrib_status || null,
        isha_status: log.isha_status || null,
        quran_surahs: log.quran_surahs || [],
        custom_worships: log.custom_worships || [],
      }, { onConflict: 'user_id,log_date' })
      .select()
      .single();
    if (error) throw error;
    return data;
  });
  clearCache();
  return result;
}

// ==================== Backup / Restore ====================

export type CloudBackupData = Pick<SabeelBackupData, 'projects' | 'tasks' | 'sessions' | 'goals' | 'settings' | 'prayerLogs'>;

export interface RestoreDomainResult {
  domain: keyof CloudBackupData;
  success: boolean;
  message?: string;
}

export interface CloudRestoreResult {
  success: boolean;
  domains: RestoreDomainResult[];
  data: CloudBackupData;
}

/** Bypass the short UI cache so an authenticated export reflects the server. */
export async function fetchBackupCloudData(userId: string): Promise<CloudBackupData> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');
  clearCache();
  const [projects, tasks, sessions, goals, settings, prayerLogs] = await Promise.all([
    fetchProjects(userId),
    fetchTasks(userId),
    fetchSessions(userId),
    fetchGoals(userId),
    fetchSettings(userId),
    fetchPrayerLogs(userId),
  ]);
  return { projects, tasks, sessions, goals, settings, prayerLogs };
}

function withCurrentUser<T extends { user_id: string }>(records: T[], userId: string): T[] {
  return records.map((record) => ({ ...record, user_id: userId }));
}

function projectsInParentFirstOrder(projects: Project[]): Project[] {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const depth = (project: Project) => {
    let result = 0;
    let parentId = project.parent_id;
    while (parentId && byId.has(parentId)) {
      result += 1;
      parentId = byId.get(parentId)?.parent_id ?? null;
    }
    return result;
  };
  return [...projects].sort((left, right) => depth(left) - depth(right));
}

function restoreErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isRecordValue(error) && typeof error.message === 'string') return error.message;
  return String(error);
}

async function accountScopedRestoreId(userId: string, domain: string, sourceId: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure ID generation is unavailable in this browser');
  const input = new TextEncoder().encode(`sabeel-restore:${domain}:${userId}:${sourceId}`);
  const bytes = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', input)).slice(0, 16);
  // RFC 4122 variant with a deterministic, name-based UUID shape.
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function fetchOwnedRecordIds(table: string, userId: string, ids: string[]): Promise<Set<string>> {
  const owned = new Set<string>();
  if (ids.length === 0) return owned;
  const supabase = await getSupabase();
  const uniqueIds = Array.from(new Set(ids));
  for (let index = 0; index < uniqueIds.length; index += 500) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq('user_id', userId)
      .in('id', uniqueIds.slice(index, index + 500));
    if (error) throw error;
    for (const row of (data || []) as Array<{ id?: unknown }>) {
      if (typeof row.id === 'string') owned.add(row.id);
    }
  }
  return owned;
}

async function createRestoreIdMap(
  userId: string,
  domain: string,
  ids: string[],
  ownedIds: Set<string>,
): Promise<Record<string, string>> {
  const entries = await Promise.all(Array.from(new Set(ids)).map(async (id): Promise<[string, string]> => [
    id,
    ownedIds.has(id) ? id : await accountScopedRestoreId(userId, domain, id),
  ]));
  return Object.fromEntries(entries);
}

function remapNumberRecord(values: Record<string, number>, idMap: Record<string, string>): Record<string, number> {
  return Object.fromEntries(Object.entries(values).map(([id, value]) => [idMap[id] || id, value]));
}

/**
 * Scope imported record IDs to the destination account. PostgreSQL UUID primary
 * keys are global, so the same backup cannot otherwise be restored into a
 * second account even though RLS correctly hides the first account's rows.
 * Existing IDs already owned by this account are preserved; unseen IDs are
 * deterministically remapped so repeated imports stay idempotent.
 */
export async function prepareBackupDataForRestore(userId: string, data: SabeelBackupData): Promise<SabeelBackupData> {
  if (!isValidUserId(userId) || !isSupabaseConfigured()) return data;

  const [ownedProjects, ownedTasks, ownedSessions, ownedGoals] = await Promise.all([
    fetchOwnedRecordIds('projects', userId, data.projects.map((record) => record.id)),
    fetchOwnedRecordIds('tasks', userId, data.tasks.map((record) => record.id)),
    fetchOwnedRecordIds('sessions', userId, data.sessions.map((record) => record.id)),
    fetchOwnedRecordIds('goals', userId, data.goals.map((record) => record.id)),
  ]);
  const [projectIds, taskIds, sessionIds, goalIds] = await Promise.all([
    createRestoreIdMap(userId, 'projects', data.projects.map((record) => record.id), ownedProjects),
    createRestoreIdMap(userId, 'tasks', data.tasks.map((record) => record.id), ownedTasks),
    createRestoreIdMap(userId, 'sessions', data.sessions.map((record) => record.id), ownedSessions),
    createRestoreIdMap(userId, 'goals', data.goals.map((record) => record.id), ownedGoals),
  ]);
  const remapProject = (project: Project): Project => ({
    ...project,
    id: projectIds[project.id] || project.id,
    parent_id: project.parent_id ? projectIds[project.parent_id] || null : null,
  });

  return {
    ...data,
    projects: data.projects.map(remapProject),
    tasks: data.tasks.map((task) => ({
      ...task,
      id: taskIds[task.id] || task.id,
      project_id: task.project_id ? projectIds[task.project_id] || null : null,
    })),
    sessions: data.sessions.map((session) => ({
      ...session,
      id: sessionIds[session.id] || session.id,
      project_id: session.project_id ? projectIds[session.project_id] || null : null,
      task_id: session.task_id ? taskIds[session.task_id] || null : null,
    })),
    goals: data.goals.map((goal) => ({
      ...goal,
      id: goalIds[goal.id] || goal.id,
      project_id: goal.project_id ? projectIds[goal.project_id] || null : null,
    })),
    deletedProjects: data.deletedProjects.map((item) => ({ ...item, project: remapProject(item.project) })),
    projectRatings: remapNumberRecord(data.projectRatings, projectIds),
    projectPlans: remapNumberRecord(data.projectPlans, projectIds),
    sessionPlans: remapNumberRecord(data.sessionPlans, sessionIds),
  };
}

async function upsertBatches(table: string, records: unknown[], onConflict = 'id'): Promise<void> {
  if (records.length === 0) return;
  const supabase = await getSupabase();
  for (let index = 0; index < records.length; index += 500) {
    const { error } = await supabase
      .from(table)
      .upsert(records.slice(index, index + 500), { onConflict });
    if (error) throw error;
  }
}

async function deleteRecordsMissingFromBackup(table: string, userId: string, keepValues: Set<string>, key = 'id'): Promise<void> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from(table).select(key).eq('user_id', userId);
  if (error) throw error;
  const records = (data || []) as unknown as Array<Record<string, unknown>>;
  const valuesToDelete = records
    .map((record) => record[key])
    .filter((value): value is string => typeof value === 'string' && !keepValues.has(value));
  for (let index = 0; index < valuesToDelete.length; index += 500) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq('user_id', userId)
      .in(key, valuesToDelete.slice(index, index + 500));
    if (deleteError) throw deleteError;
  }
}

/**
 * Restore validated cloud domains for the current account only. Imported
 * user_id values are discarded before every write. Replacement deletions are
 * staged until every upsert domain succeeds, preventing delete-after-failure.
 */
export async function restoreCloudData(
  userId: string,
  data: CloudBackupData,
  mode: ImportMode,
): Promise<CloudRestoreResult> {
  if (!isValidUserId(userId)) throw new Error('المستخدم غير مسجل الدخول');

  if (!isSupabaseConfigured()) {
    const projects = withCurrentUser(data.projects, userId);
    const tasks = withCurrentUser(data.tasks, userId);
    const sessions = withCurrentUser(data.sessions, userId);
    const goals = withCurrentUser(data.goals, userId);
    const prayerLogs = withCurrentUser(data.prayerLogs, userId);
    const merge = <T>(current: T[], incoming: T[], key: (record: T) => string) => {
      if (mode === 'replace') return incoming;
      const byId = new Map(current.map((record) => [key(record), record]));
      incoming.forEach((record) => byId.set(key(record), record));
      return Array.from(byId.values());
    };
    setLocalData('sabeel_projects', userId, merge(getLocalData<Project>('sabeel_projects', userId), projects, (record) => record.id));
    setLocalData('sabeel_tasks', userId, merge(getLocalData<Task>('sabeel_tasks', userId), tasks, (record) => record.id));
    setLocalData('sabeel_sessions', userId, merge(getLocalData<Session>('sabeel_sessions', userId), sessions, (record) => record.id));
    setLocalData('sabeel_goals', userId, merge(getLocalData<Goal>('sabeel_goals', userId), goals, (record) => record.id));
    setLocalData('sabeel_prayers', userId, merge(getLocalData<PrayerLog>('sabeel_prayers', userId), prayerLogs, (record) => record.log_date));
    if (data.settings) setLocalSingle('sabeel_settings', userId, { ...data.settings, user_id: userId });
    const restored = await fetchBackupCloudData(userId);
    return {
      success: true,
      domains: [
        { domain: 'projects', success: true }, { domain: 'tasks', success: true },
        { domain: 'sessions', success: true }, { domain: 'goals', success: true },
        { domain: 'settings', success: true }, { domain: 'prayerLogs', success: true },
      ],
      data: restored,
    };
  }

  const domains: RestoreDomainResult[] = [];
  const recordResult = async (domain: keyof CloudBackupData, operation: () => Promise<void>) => {
    try {
      await operation();
      domains.push({ domain, success: true });
    } catch (error) {
      domains.push({ domain, success: false, message: restoreErrorMessage(error) });
    }
  };

  await recordResult('projects', () => upsertBatches('projects', withCurrentUser(projectsInParentFirstOrder(data.projects), userId)));
  await recordResult('tasks', () => upsertBatches('tasks', withCurrentUser(data.tasks, userId)));
  await recordResult('sessions', () => upsertBatches('sessions', withCurrentUser(data.sessions, userId)));
  await recordResult('goals', () => upsertBatches('goals', withCurrentUser(data.goals, userId)));
  await recordResult('settings', async () => {
    if (!data.settings) return;
    const settings = Object.fromEntries(
      Object.entries(data.settings).filter(([key]) => key !== 'id' && key !== 'user_id'),
    );
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('user_settings')
      .upsert({ ...settings, user_id: userId }, { onConflict: 'user_id' });
    if (error) throw error;
  });
  await recordResult('prayerLogs', async () => {
    const rows = withCurrentUser(data.prayerLogs, userId).map((record) =>
      Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'id')),
    );
    await upsertBatches('prayer_logs', rows, 'user_id,log_date');
  });

  const upsertsSucceeded = domains.every((domain) => domain.success);
  if (mode === 'replace' && upsertsSucceeded) {
    const deletionPlan: Array<[keyof CloudBackupData, string, Set<string>, string?]> = [
      ['sessions', 'sessions', new Set(data.sessions.map((record) => record.id))],
      ['tasks', 'tasks', new Set(data.tasks.map((record) => record.id))],
      ['goals', 'goals', new Set(data.goals.map((record) => record.id))],
      ['prayerLogs', 'prayer_logs', new Set(data.prayerLogs.map((record) => record.log_date)), 'log_date'],
      ['projects', 'projects', new Set(data.projects.map((record) => record.id))],
    ];
    for (const [domain, table, values, key] of deletionPlan) {
      try {
        await deleteRecordsMissingFromBackup(table, userId, values, key);
      } catch (error) {
        const existing = domains.find((result) => result.domain === domain);
        if (existing) {
          existing.success = false;
          existing.message = `Replacement cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }
  }

  clearCache();
  let restored: CloudBackupData;
  try {
    restored = await fetchBackupCloudData(userId);
  } catch (error) {
    const failed = domains.filter((domain) => !domain.success).map((domain) => domain.domain).join(', ');
    const status = failed ? `Failed domains: ${failed}. ` : '';
    throw new Error(`${status}Restore writes finished, but refreshed data could not be loaded: ${restoreErrorMessage(error)}`);
  }
  return { success: domains.every((domain) => domain.success), domains, data: restored };
}
