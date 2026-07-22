/**
 * Versioned Sabeel backup format.
 *
 * Cloud-backed records are supplied by fresh user-scoped API reads. Browser-
 * only records are supplied by the current account's Zustand state. This file
 * never reads authentication storage and never serializes credentials/tokens.
 */

import type {
  AppNotification,
  CustomWorship,
  DeletedProject,
  Goal,
  LibraryResource,
  PrayerLog,
  Project,
  Session,
  Task,
  UserSettings,
  VideoItem,
} from './types';
import { readStorageJson, writeStorageJson } from './storage';

export const BACKUP_VERSION = '2.0.0';
const BACKUP_APP_NAME = 'al-sabeel';
const BACKUP_SCHEMA_VERSION = 2;
const MAX_BACKUP_BYTES = 15 * 1024 * 1024;
const MAX_DOMAIN_RECORDS = 20_000;

const CLOUD_DOMAINS = ['projects', 'tasks', 'sessions', 'goals', 'settings', 'prayerLogs'] as const;
const BROWSER_DOMAINS = ['deletedProjects', 'projectRatings', 'projectPlans', 'sessionPlans', 'libraryResources', 'videoItems', 'notifications'] as const;

export type ImportMode = 'replace' | 'merge';

export interface SabeelBackupData {
  projects: Project[];
  tasks: Task[];
  sessions: Session[];
  goals: Goal[];
  settings: UserSettings | null;
  prayerLogs: PrayerLog[];
  deletedProjects: DeletedProject[];
  projectRatings: Record<string, number>;
  projectPlans: Record<string, number>;
  sessionPlans: Record<string, number>;
  libraryResources: LibraryResource[];
  videoItems: VideoItem[];
  notifications: AppNotification[];
}

export interface SabeelBackup {
  version: string;
  appName: typeof BACKUP_APP_NAME;
  exportedAt: string;
  metadata: {
    schemaVersion: number;
    source: 'cloud' | 'offline';
    cloudBacked: readonly string[];
    browserOnly: readonly string[];
  };
  data: SabeelBackupData;
  preferences: {
    language: 'ar' | 'en';
    darkMode: boolean;
  };
  // Legacy v1 files may contain these. They are accepted but never trusted.
  userId?: string | null;
  userEmail?: string | null;
}

export interface BackupSource {
  source: 'cloud' | 'offline';
  data: SabeelBackupData;
  preferences: SabeelBackup['preferences'];
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  backup?: SabeelBackup;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string, maxLength = 10_000): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function boundedString(value: unknown, field: string, maxLength = 10_000): string {
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`Invalid ${field}`);
  return value;
}

function optionalString(value: unknown, field: string, maxLength = 10_000): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredString(value, field, maxLength);
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${field}`);
  return value;
}

function finiteNumber(value: unknown, field: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function safeId(value: unknown, field = 'id'): string {
  const id = requiredString(value, field, 128);
  if (!/^[A-Za-z0-9_-]+$/.test(id) || id === '__proto__' || id === 'constructor' || id === 'prototype') {
    throw new Error(`Invalid ${field}`);
  }
  return id;
}

function nullableId(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return safeId(value, field);
}

function timestamp(value: unknown, field: string): string {
  const result = requiredString(value, field, 64);
  if (!Number.isFinite(Date.parse(result))) throw new Error(`Invalid ${field}`);
  return result;
}

function dateKey(value: unknown, field: string): string {
  const result = requiredString(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error(`Invalid ${field}`);
  const [year, month, day] = result.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate()) {
    throw new Error(`Invalid ${field}`);
  }
  return result;
}

function safeUrl(value: unknown, field: string): string {
  if (value === '' || value === null || value === undefined) return '';
  const result = requiredString(value, field, 2_048);
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(result)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') {
    throw new Error(`Unsafe ${field}`);
  }
  if (scheme) {
    try {
      new URL(result);
    } catch {
      throw new Error(`Invalid ${field}`);
    }
  }
  return result;
}

function arrayDomain<T>(value: unknown, domain: string, sanitizer: (record: unknown, index: number) => T): T[] {
  if (!Array.isArray(value) || value.length > MAX_DOMAIN_RECORDS) {
    throw new Error(`Invalid or oversized domain: ${domain}`);
  }
  return value.map((record, index) => sanitizer(record, index));
}

function projectRecord(value: unknown, index: number): Project {
  if (!isRecord(value)) throw new Error(`Invalid projects[${index}]`);
  return {
    id: safeId(value.id, `projects[${index}].id`),
    user_id: '',
    name: requiredString(value.name, `projects[${index}].name`, 500),
    description: optionalString(value.description, `projects[${index}].description`, 20_000),
    color: optionalString(value.color, `projects[${index}].color`, 64),
    is_folder: value.is_folder === undefined ? false : requiredBoolean(value.is_folder, `projects[${index}].is_folder`),
    parent_id: nullableId(value.parent_id, `projects[${index}].parent_id`),
    created_at: timestamp(value.created_at, `projects[${index}].created_at`),
    updated_at: timestamp(value.updated_at, `projects[${index}].updated_at`),
  };
}

function taskRecord(value: unknown, index: number): Task {
  if (!isRecord(value)) throw new Error(`Invalid tasks[${index}]`);
  const recurringDays = value.recurring_days === null || value.recurring_days === undefined
    ? null
    : arrayDomain<number>(value.recurring_days, `tasks[${index}].recurring_days`, (day) => finiteNumber(day, 'recurring day', 0, 6));
  return {
    id: safeId(value.id, `tasks[${index}].id`),
    user_id: '',
    project_id: nullableId(value.project_id, `tasks[${index}].project_id`),
    title: requiredString(value.title, `tasks[${index}].title`, 1_000),
    description: optionalString(value.description, `tasks[${index}].description`, 20_000),
    is_completed: requiredBoolean(value.is_completed, `tasks[${index}].is_completed`),
    is_recurring: value.is_recurring === undefined ? false : requiredBoolean(value.is_recurring, `tasks[${index}].is_recurring`),
    recurring_days: recurringDays,
    due_date: value.due_date ? dateKey(value.due_date, `tasks[${index}].due_date`) : null,
    created_at: timestamp(value.created_at, `tasks[${index}].created_at`),
    updated_at: timestamp(value.updated_at, `tasks[${index}].updated_at`),
  };
}

function sessionRecord(value: unknown, index: number): Session {
  if (!isRecord(value)) throw new Error(`Invalid sessions[${index}]`);
  return {
    id: safeId(value.id, `sessions[${index}].id`),
    user_id: '',
    project_id: nullableId(value.project_id, `sessions[${index}].project_id`),
    task_id: nullableId(value.task_id, `sessions[${index}].task_id`),
    start_time: timestamp(value.start_time, `sessions[${index}].start_time`),
    end_time: value.end_time ? timestamp(value.end_time, `sessions[${index}].end_time`) : null,
    duration: finiteNumber(value.duration, `sessions[${index}].duration`, 0, 1_000_000),
    session_date: dateKey(value.session_date, `sessions[${index}].session_date`),
    created_at: timestamp(value.created_at, `sessions[${index}].created_at`),
    updated_at: timestamp(value.updated_at, `sessions[${index}].updated_at`),
  };
}

const GOAL_TYPES = new Set(['daily_hours', 'weekly_hours', 'daily_tasks', 'weekly_tasks']);
function goalRecord(value: unknown, index: number): Goal {
  if (!isRecord(value)) throw new Error(`Invalid goals[${index}]`);
  const goalType = requiredString(value.goal_type, `goals[${index}].goal_type`, 32);
  if (!GOAL_TYPES.has(goalType)) throw new Error(`Invalid goals[${index}].goal_type`);
  return {
    id: safeId(value.id, `goals[${index}].id`),
    user_id: '',
    project_id: nullableId(value.project_id, `goals[${index}].project_id`),
    goal_type: goalType as Goal['goal_type'],
    target_value: finiteNumber(value.target_value, `goals[${index}].target_value`, 0, 1_000_000),
    created_at: timestamp(value.created_at, `goals[${index}].created_at`),
    updated_at: timestamp(value.updated_at, `goals[${index}].updated_at`),
  };
}

function settingsRecord(value: unknown): UserSettings | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new Error('Invalid settings');
  return {
    id: safeId(value.id, 'settings.id'),
    user_id: '',
    enable_pomodoro: requiredBoolean(value.enable_pomodoro, 'settings.enable_pomodoro'),
    enable_goals: requiredBoolean(value.enable_goals, 'settings.enable_goals'),
    enable_analytics: requiredBoolean(value.enable_analytics, 'settings.enable_analytics'),
    pomodoro_work_duration: finiteNumber(value.pomodoro_work_duration, 'settings.pomodoro_work_duration', 1, 120),
    pomodoro_break_duration: finiteNumber(value.pomodoro_break_duration, 'settings.pomodoro_break_duration', 1, 60),
    adhan_enabled: value.adhan_enabled === undefined ? true : requiredBoolean(value.adhan_enabled, 'settings.adhan_enabled'),
    alarm_sound: typeof value.alarm_sound === 'string' ? requiredString(value.alarm_sound, 'settings.alarm_sound', 64) : 'bell',
    custom_alarm_data: value.custom_alarm_data === undefined ? '' : boundedString(value.custom_alarm_data, 'settings.custom_alarm_data', 7 * 1024 * 1024),
    created_at: timestamp(value.created_at, 'settings.created_at'),
    updated_at: timestamp(value.updated_at, 'settings.updated_at'),
  };
}

const PRAYER_STATUSES = new Set(['mosque', 'home', 'late', 'missed']);
function prayerStatus(value: unknown, field: string): PrayerLog['fajr_status'] {
  if (value === null || value === undefined || value === '') return null;
  const status = requiredString(value, field, 16);
  if (!PRAYER_STATUSES.has(status)) throw new Error(`Invalid ${field}`);
  return status as PrayerLog['fajr_status'];
}

function customWorshipRecord(value: unknown, index: number): CustomWorship {
  if (!isRecord(value)) throw new Error(`Invalid custom_worships[${index}]`);
  return {
    id: safeId(value.id, `custom_worships[${index}].id`),
    name: requiredString(value.name, `custom_worships[${index}].name`, 500),
    category: requiredString(value.category, `custom_worships[${index}].category`, 200),
    target: finiteNumber(value.target, `custom_worships[${index}].target`, 0, 1_000_000),
    unit: requiredString(value.unit, `custom_worships[${index}].unit`, 100),
    log_date: value.log_date ? dateKey(value.log_date, `custom_worships[${index}].log_date`) : '',
    value: finiteNumber(value.value, `custom_worships[${index}].value`, 0, 1_000_000),
    notes: value.notes === undefined ? '' : boundedString(value.notes, 'custom worship notes', 10_000),
  };
}

function prayerRecord(value: unknown, index: number): PrayerLog {
  if (!isRecord(value)) throw new Error(`Invalid prayerLogs[${index}]`);
  const booleanField = (field: string) => value[field] === undefined ? false : requiredBoolean(value[field], `prayerLogs[${index}].${field}`);
  const quranSurahs = value.quran_surahs === undefined
    ? []
    : arrayDomain<string>(value.quran_surahs, `prayerLogs[${index}].quran_surahs`, (surah) => requiredString(surah, 'quran surah', 200));
  const customWorships = value.custom_worships === undefined
    ? []
    : arrayDomain<CustomWorship>(value.custom_worships, `prayerLogs[${index}].custom_worships`, customWorshipRecord);
  return {
    id: safeId(value.id, `prayerLogs[${index}].id`),
    user_id: '',
    log_date: dateKey(value.log_date, `prayerLogs[${index}].log_date`),
    fajr: booleanField('fajr'), dhuhr: booleanField('dhuhr'), asr: booleanField('asr'),
    maghrib: booleanField('maghrib'), isha: booleanField('isha'),
    fajr_sunnah: booleanField('fajr_sunnah'), dhuhr_sunnah: booleanField('dhuhr_sunnah'),
    asr_sunnah: booleanField('asr_sunnah'), maghrib_sunnah: booleanField('maghrib_sunnah'),
    isha_sunnah: booleanField('isha_sunnah'),
    quran_pages: finiteNumber(value.quran_pages ?? 0, `prayerLogs[${index}].quran_pages`, 0, 100_000),
    quran_notes: value.quran_notes === undefined ? '' : boundedString(value.quran_notes, 'quran notes', 50_000),
    fajr_status: prayerStatus(value.fajr_status, 'fajr_status'),
    dhuhr_status: prayerStatus(value.dhuhr_status, 'dhuhr_status'),
    asr_status: prayerStatus(value.asr_status, 'asr_status'),
    maghrib_status: prayerStatus(value.maghrib_status, 'maghrib_status'),
    isha_status: prayerStatus(value.isha_status, 'isha_status'),
    quran_surahs: quranSurahs,
    custom_worships: customWorships,
    created_at: timestamp(value.created_at, `prayerLogs[${index}].created_at`),
    updated_at: timestamp(value.updated_at, `prayerLogs[${index}].updated_at`),
  };
}

function deletedProjectRecord(value: unknown, index: number): DeletedProject {
  if (!isRecord(value)) throw new Error(`Invalid deletedProjects[${index}]`);
  return {
    project: projectRecord(value.project, index),
    deletedAt: timestamp(value.deletedAt, `deletedProjects[${index}].deletedAt`),
  };
}

const RESOURCE_TYPES = new Set(['book', 'article', 'pdf', 'link', 'note', 'other']);
function libraryRecord(value: unknown, index: number): LibraryResource {
  if (!isRecord(value)) throw new Error(`Invalid libraryResources[${index}]`);
  const type = requiredString(value.type, `libraryResources[${index}].type`, 16);
  if (!RESOURCE_TYPES.has(type)) throw new Error(`Invalid libraryResources[${index}].type`);
  return {
    id: safeId(value.id, `libraryResources[${index}].id`),
    name: requiredString(value.name, `libraryResources[${index}].name`, 1_000),
    type: type as LibraryResource['type'],
    category: boundedString(value.category, `libraryResources[${index}].category`, 500),
    url: safeUrl(value.url, `libraryResources[${index}].url`),
    description: value.description === undefined ? '' : boundedString(value.description, 'resource description', 20_000),
    createdAt: timestamp(value.createdAt, `libraryResources[${index}].createdAt`),
  };
}

function videoRecord(value: unknown, index: number): VideoItem {
  if (!isRecord(value)) throw new Error(`Invalid videoItems[${index}]`);
  return {
    id: safeId(value.id, `videoItems[${index}].id`),
    name: requiredString(value.name, `videoItems[${index}].name`, 1_000),
    category: boundedString(value.category, `videoItems[${index}].category`, 500),
    url: safeUrl(value.url, `videoItems[${index}].url`),
    duration: value.duration === undefined ? '' : boundedString(value.duration, 'video duration', 100),
    description: value.description === undefined ? '' : boundedString(value.description, 'video description', 20_000),
    createdAt: timestamp(value.createdAt, `videoItems[${index}].createdAt`),
  };
}

const NOTIFICATION_TYPES = new Set(['timer', 'task', 'goal', 'streak', 'resource', 'video', 'info', 'prayer']);
function notificationRecord(value: unknown, index: number): AppNotification {
  if (!isRecord(value)) throw new Error(`Invalid notifications[${index}]`);
  const type = requiredString(value.type, `notifications[${index}].type`, 32);
  if (!NOTIFICATION_TYPES.has(type)) throw new Error(`Invalid notifications[${index}].type`);
  return {
    id: safeId(value.id, `notifications[${index}].id`),
    title: requiredString(value.title, `notifications[${index}].title`, 1_000),
    message: requiredString(value.message, `notifications[${index}].message`, 10_000),
    type: type as AppNotification['type'],
    read: requiredBoolean(value.read, `notifications[${index}].read`),
    createdAt: timestamp(value.createdAt, `notifications[${index}].createdAt`),
  };
}

function ratingsRecord(value: unknown): Record<string, number> {
  if (!isRecord(value) || Object.keys(value).length > MAX_DOMAIN_RECORDS) throw new Error('Invalid projectRatings');
  const result: Record<string, number> = {};
  for (const [projectId, rating] of Object.entries(value)) {
    result[safeId(projectId, 'projectRatings key')] = finiteNumber(rating, 'project rating', 0, 5);
  }
  return result;
}

function minutesRecord(value: unknown, field: string): Record<string, number> {
  if (value === undefined || value === null) return {};
  if (!isRecord(value) || Object.keys(value).length > MAX_DOMAIN_RECORDS) throw new Error(`Invalid ${field}`);
  const result: Record<string, number> = {};
  for (const [id, minutes] of Object.entries(value)) {
    result[safeId(id, `${field} key`)] = finiteNumber(minutes, `${field} minutes`, 0, 10_000_000);
  }
  return result;
}

function sanitizeData(value: unknown): SabeelBackupData {
  if (!isRecord(value)) throw new Error('Missing backup data');
  const data: SabeelBackupData = {
    projects: arrayDomain(value.projects, 'projects', projectRecord),
    tasks: arrayDomain(value.tasks, 'tasks', taskRecord),
    sessions: arrayDomain(value.sessions, 'sessions', sessionRecord),
    goals: arrayDomain(value.goals, 'goals', goalRecord),
    settings: settingsRecord(value.settings),
    prayerLogs: arrayDomain(value.prayerLogs, 'prayerLogs', prayerRecord),
    deletedProjects: arrayDomain(value.deletedProjects, 'deletedProjects', deletedProjectRecord),
    projectRatings: ratingsRecord(value.projectRatings),
    projectPlans: minutesRecord(value.projectPlans, 'projectPlans'),
    sessionPlans: minutesRecord(value.sessionPlans, 'sessionPlans'),
    libraryResources: arrayDomain(value.libraryResources, 'libraryResources', libraryRecord),
    videoItems: arrayDomain(value.videoItems, 'videoItems', videoRecord),
    notifications: arrayDomain(value.notifications, 'notifications', notificationRecord),
  };
  if (data.notifications.length > 50) throw new Error('Oversized domain: notifications (maximum 50)');

  // Legacy backups could keep a trashed project only in the trash snapshot.
  // Restore its backing record too so the trash item remains restorable.
  const projectIds = new Set(data.projects.map((project) => project.id));
  for (const item of data.deletedProjects) {
    if (!projectIds.has(item.project.id)) {
      data.projects.push(item.project);
      projectIds.add(item.project.id);
    }
  }
  const projectById = new Map(data.projects.map((project) => [project.id, project]));

  const assertUnique = <T>(records: T[], getId: (record: T) => string, domain: string) => {
    const ids = new Set<string>();
    for (const record of records) {
      const id = getId(record);
      if (ids.has(id)) throw new Error(`Duplicate record in ${domain}: ${id}`);
      ids.add(id);
    }
  };
  assertUnique(data.projects, (record) => record.id, 'projects');
  assertUnique(data.tasks, (record) => record.id, 'tasks');
  assertUnique(data.sessions, (record) => record.id, 'sessions');
  assertUnique(data.goals, (record) => record.id, 'goals');
  assertUnique(data.prayerLogs, (record) => record.log_date, 'prayerLogs');
  assertUnique(data.deletedProjects, (record) => record.project.id, 'deletedProjects');
  assertUnique(data.libraryResources, (record) => record.id, 'libraryResources');
  assertUnique(data.videoItems, (record) => record.id, 'videoItems');
  assertUnique(data.notifications, (record) => record.id, 'notifications');

  const taskIds = new Set(data.tasks.map((task) => task.id));
  for (const project of data.projects) {
    // Older backups can contain projects whose folder was deleted before the
    // backup was created. Keep the project and restore it as standalone rather
    // than rejecting the entire backup or inventing a missing folder.
    if (project.parent_id && !projectIds.has(project.parent_id)) {
      project.parent_id = null;
    }
    if (project.parent_id === project.id) {
      throw new Error(`Invalid project parent reference: ${project.id}`);
    }
    const visited = new Set([project.id]);
    let parentId = project.parent_id;
    while (parentId) {
      if (visited.has(parentId)) throw new Error(`Cyclic project hierarchy: ${project.id}`);
      visited.add(parentId);
      if (visited.size > 100) throw new Error(`Project hierarchy is too deep: ${project.id}`);
      parentId = projectById.get(parentId)?.parent_id ?? null;
    }
  }
  for (const task of data.tasks) {
    if (task.project_id && !projectIds.has(task.project_id)) throw new Error(`Invalid task project reference: ${task.id}`);
  }
  for (const session of data.sessions) {
    if (session.project_id && !projectIds.has(session.project_id)) throw new Error(`Invalid session project reference: ${session.id}`);
    if (session.task_id && !taskIds.has(session.task_id)) throw new Error(`Invalid session task reference: ${session.id}`);
  }
  for (const goal of data.goals) {
    if (goal.project_id && !projectIds.has(goal.project_id)) throw new Error(`Invalid goal project reference: ${goal.id}`);
  }
  return data;
}

export function createBackup(source: BackupSource): SabeelBackup {
  return {
    version: BACKUP_VERSION,
    appName: BACKUP_APP_NAME,
    exportedAt: new Date().toISOString(),
    metadata: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      source: source.source,
      cloudBacked: CLOUD_DOMAINS,
      browserOnly: BROWSER_DOMAINS,
    },
    // Reuse import sanitization for export so identity fields and unknown
    // properties never enter the file.
    data: sanitizeData(source.data),
    preferences: source.preferences,
  };
}

export function validateBackup(value: unknown): BackupValidationResult {
  try {
    if (!isRecord(value)) throw new Error('Invalid file format');
    const version = requiredString(value.version, 'version', 32);
    if (version !== '1.0.0' && version !== BACKUP_VERSION) throw new Error(`Unsupported backup version: ${version}`);
    if (value.appName !== BACKUP_APP_NAME) throw new Error('This file is not a Sabeel backup');
    const exportedAt = timestamp(value.exportedAt, 'exportedAt');
    const data = sanitizeData(value.data);
    const preferences = isRecord(value.preferences) ? value.preferences : {};
    if (preferences.language !== undefined && preferences.language !== 'ar' && preferences.language !== 'en') {
      throw new Error('Invalid preference: language');
    }
    if (preferences.darkMode !== undefined && typeof preferences.darkMode !== 'boolean') {
      throw new Error('Invalid preference: darkMode');
    }
    const language = preferences.language === 'en' ? 'en' : 'ar';
    const darkMode = preferences.darkMode === true;

    return {
      valid: true,
      backup: {
        version,
        appName: BACKUP_APP_NAME,
        exportedAt,
        metadata: {
          schemaVersion: version === '1.0.0' ? 1 : BACKUP_SCHEMA_VERSION,
          source: isRecord(value.metadata) && value.metadata.source === 'offline' ? 'offline' : 'cloud',
          cloudBacked: CLOUD_DOMAINS,
          browserOnly: BROWSER_DOMAINS,
        },
        data,
        preferences: { language, darkMode },
      },
    };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Invalid backup file' };
  }
}

export function downloadBackup(backup: SabeelBackup): void {
  const json = JSON.stringify(backup, null, 2);
  if (new Blob([json]).size > MAX_BACKUP_BYTES) throw new Error('Backup is too large to export safely');
  const date = new Date();
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `sabeel-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function saveSafetyBackup(userId: string, backup: SabeelBackup): void {
  if (!writeStorageJson(`sabeel_auto_backup:${userId}`, backup)) {
    throw new Error('Could not create the required safety backup');
  }
}

export function getAutoBackup(userId: string): SabeelBackup | null {
  const raw = readStorageJson<unknown>(`sabeel_auto_backup:${userId}`, null);
  const validation = validateBackup(raw);
  return validation.valid ? validation.backup ?? null : null;
}

export function readBackupFile(file: File): Promise<SabeelBackup> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_BACKUP_BYTES) {
      reject(new Error('Backup file is too large'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result;
        if (typeof raw !== 'string') throw new Error('Failed to read file');
        const validation = validateBackup(JSON.parse(raw));
        if (!validation.valid || !validation.backup) throw new Error(validation.error || 'Invalid backup file');
        resolve(validation.backup);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to parse backup file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function getBackupSummary(backup: SabeelBackup, language: 'ar' | 'en'): { label: string; count: number }[] {
  const { data } = backup;
  const ar = language === 'ar';
  return [
    { label: ar ? 'المشاريع' : 'Projects', count: data.projects.length },
    { label: ar ? 'المهام' : 'Tasks', count: data.tasks.length },
    { label: ar ? 'الجلسات' : 'Sessions', count: data.sessions.length },
    { label: ar ? 'الأهداف' : 'Goals', count: data.goals.length },
    { label: ar ? 'سجل الصلوات' : 'Prayer Logs', count: data.prayerLogs.length },
    { label: ar ? 'المكتبة الرقمية' : 'Library', count: data.libraryResources.length },
    { label: ar ? 'الفيديوهات' : 'Videos', count: data.videoItems.length },
    { label: ar ? 'الإشعارات' : 'Notifications', count: data.notifications.length },
    { label: ar ? 'سلة المهملات' : 'Trash', count: data.deletedProjects.length },
  ];
}
