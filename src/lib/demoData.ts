import { fetchBackupCloudData, restoreCloudData } from './api';
import { toLocalDateKey } from './localDate';
import { isLocalDemoRequested, LOCAL_DEMO_MARKER, LOCAL_DEMO_USER_ID } from './demoMode';
import { useAppStore } from './store';
import { isSupabaseConfigured } from './supabaseConfig';
import type { AppNotification, Goal, LibraryResource, PrayerLog, Project, Session, Task, UserSettings, VideoItem } from './types';

function localDay(offset: number): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

function makeDemoData(userId: string) {
  const now = new Date().toISOString();
  const id = (kind: string, index: number) => `demo-${kind}-${index}`;
  const projects: Project[] = [
    ['البحث والتعلّم', 'مساحة للمذاكرة والتطوير الشخصي', '#8b79bd', true, null],
    ['البحث العلمي', 'قراءة المراجع وتجهيز ملخصات البحث', '#7968ae', false, id('project', 0)],
    ['كتابة المحتوى', 'مقالات وأفكار قيد التحضير', '#a989c9', false, null],
    ['تطوير الذات', 'مهارات وعادات يومية', '#8ea9cd', false, id('project', 0)],
    ['مشروع خاص', 'خطوات صغيرة لبناء الفكرة', '#c5a0a9', false, null],
  ].map(([name, description, color, is_folder, parent_id], index) => ({
    id: id('project', index), user_id: userId, name: String(name), description: String(description),
    color: String(color), is_folder: Boolean(is_folder), parent_id: parent_id as string | null,
    created_at: now, updated_at: now,
  }));

  const taskRows: Array<[string, number, number, boolean]> = [
    ['مراجعة فصل المنهجية', 1, 0, false],
    ['تلخيص ثلاث أوراق بحثية', 1, 2, false],
    ['تجهيز مخطط المقال القادم', 2, 1, false],
    ['كتابة مسودة المقدمة', 2, 3, false],
    ['مراجعة درس الواجهة', 3, 0, true],
    ['قراءة ٢٠ صفحة', 3, 1, false],
    ['تحديد أهداف الأسبوع', 4, 4, false],
    ['تنظيم ملفات المشروع', 4, -1, true],
    ['تحديث قائمة المصادر', 1, -2, true],
    ['تحسين صفحة البداية', 4, 5, false],
  ];
  const tasks: Task[] = taskRows.map(([title, projectIndex, dueOffset, completed], index) => ({
    id: id('task', index), user_id: userId, project_id: id('project', projectIndex), title,
    description: index % 3 === 0 ? 'مهمة تجريبية لعرض شكل المشروع بعد إضافة البيانات.' : null,
    is_completed: completed, is_recurring: false, recurring_days: null,
    due_date: toLocalDateKey(localDay(dueOffset)), created_at: now, updated_at: now,
  }));

  const sessions: Session[] = Array.from({ length: 28 }, (_, index) => {
    const dayOffset = -Math.floor(index / 2);
    const date = localDay(dayOffset);
    const projectIndex = [1, 2, 3, 4][index % 4];
    const taskIndex = taskRows.findIndex(([, taskProject]) => taskProject === projectIndex);
    const minutes = [25, 45, 50, 35, 60, 30][index % 6];
    const start = new Date(date);
    start.setHours(index % 2 === 0 ? 10 : 17, index % 3 === 0 ? 30 : 0, 0, 0);
    const end = new Date(start.getTime() + minutes * 60_000);
    return {
      id: id('session', index), user_id: userId, project_id: id('project', projectIndex),
      task_id: id('task', taskIndex), start_time: start.toISOString(),
      end_time: end.toISOString(), duration: minutes, session_date: toLocalDateKey(date),
      created_at: start.toISOString(), updated_at: end.toISOString(),
    };
  });

  const goals: Goal[] = [
    { id: id('goal', 0), user_id: userId, project_id: null, goal_type: 'daily_hours', target_value: 2, goal_kind: 'metric', title: 'ساعتان تركيز يوميًا', created_at: now, updated_at: now },
    { id: id('goal', 1), user_id: userId, project_id: null, goal_type: 'weekly_tasks', target_value: 8, goal_kind: 'metric', title: 'إنجاز ٨ مهام أسبوعيًا', created_at: now, updated_at: now },
    { id: id('goal', 2), user_id: userId, project_id: id('project', 1), goal_type: 'weekly_hours', target_value: 6, goal_kind: 'metric', title: '٦ ساعات للبحث العلمي', created_at: now, updated_at: now },
    { id: id('goal', 3), user_id: userId, project_id: null, goal_type: 'daily_tasks', target_value: 1, goal_kind: 'general', title: 'إنهاء مسودة المقال', description: 'هدف تجريبي لهذا الشهر', target_date: toLocalDateKey(localDay(12)), is_completed: false, created_at: now, updated_at: now },
  ];

  const prayerLogs: PrayerLog[] = Array.from({ length: 10 }, (_, index) => {
    const date = toLocalDateKey(localDay(-index));
    return {
      id: id('prayer', index), user_id: userId, log_date: date,
      fajr: index % 5 !== 0, dhuhr: true, asr: true, maghrib: index % 4 !== 0, isha: index % 3 !== 0,
      fajr_sunnah: index % 2 === 0, dhuhr_sunnah: index % 3 !== 0, asr_sunnah: false,
      maghrib_sunnah: index % 2 === 0, isha_sunnah: index % 2 === 0,
      quran_pages: [2, 4, 3, 5, 1][index % 5], quran_notes: '',
      fajr_status: index % 5 !== 0 ? 'home' : null, dhuhr_status: 'home', asr_status: 'home',
      maghrib_status: index % 4 !== 0 ? 'home' : null, isha_status: index % 3 !== 0 ? 'home' : null,
      quran_surahs: [], custom_worships: [], created_at: now, updated_at: now,
    };
  });

  const settings: UserSettings = {
    id: id('settings', 0), user_id: userId, enable_pomodoro: true, enable_goals: true,
    enable_analytics: true, pomodoro_work_duration: 25, pomodoro_break_duration: 5,
    adhan_enabled: false, alarm_sound: 'default', custom_alarm_data: '', created_at: now, updated_at: now,
  };
  const libraryResources: LibraryResource[] = [
    ['دليل البحث ومراجعة المصادر', 'article', 'بحث', 'https://scholar.google.com/', 'مرجع تجريبي للبحث العلمي'],
    ['ملاحظات المشروع', 'note', 'تخطيط', '', 'أفكار أولية للخطوات القادمة'],
    ['توثيق أساسيات الويب', 'link', 'تطوير', 'https://developer.mozilla.org/ar/', 'مصدر للتعلّم والمتابعة'],
    ['قائمة القراءة', 'book', 'قراءة', '', 'كتب ومراجع أرغب في مراجعتها'],
  ].map(([name, type, category, url, description], index) => ({
    id: id('resource', index), name, type: type as LibraryResource['type'], category, url, description, createdAt: now,
  }));
  const videoItems: VideoItem[] = [
    { id: id('video', 0), name: 'مدخل إلى JavaScript', category: 'تطوير', url: 'https://www.youtube.com/watch?v=PkZNo7MFNFg', duration: '3:26:43', description: 'فيديو تجريبي من مكتبة التعلّم', createdAt: now },
    { id: id('video', 1), name: 'أساسيات Python', category: 'تطوير', url: 'https://www.youtube.com/watch?v=rfscVS0vtbw', duration: '4:26:52', description: 'فيديو تجريبي لتجربة عرض القائمة', createdAt: now },
  ];
  const notifications: AppNotification[] = [
    { id: id('notification', 0), title: 'بداية يوم جديد', message: 'عندك مهام بسيطة جاهزة للإنجاز اليوم.', type: 'task', read: false, createdAt: now },
    { id: id('notification', 1), title: 'وقت تركيز', message: 'جرّب جلسة تركيز قصيرة على مشروعك.', type: 'timer', read: false, createdAt: now },
    { id: id('notification', 2), title: 'تقدّم الأسبوع', message: 'راجع تقدمك في الأهداف والإحصائيات.', type: 'goal', read: true, createdAt: now },
  ];
  return { projects, tasks, sessions, goals, settings, prayerLogs, libraryResources, videoItems, notifications };
}

/** Explicit, local-only demo. Existing account data is never replaced. */
export async function seedLocalDemoIfRequested(userId: string): Promise<boolean> {
  if (!isLocalDemoRequested() || userId !== LOCAL_DEMO_USER_ID) return false;
  if (isSupabaseConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')) return false;
  const marker = `${LOCAL_DEMO_MARKER}:${userId}`;
  if (localStorage.getItem(marker)) return false;

  const current = await fetchBackupCloudData(userId);
  const store = useAppStore.getState();
  if (current.projects.length || current.tasks.length || current.sessions.length || current.goals.length || current.prayerLogs.length ||
    store.libraryResources.length || store.videoItems.length || store.notifications.length) return false;

  const demo = makeDemoData(userId);
  const result = await restoreCloudData(userId, {
    projects: demo.projects, tasks: demo.tasks, sessions: demo.sessions, goals: demo.goals,
    settings: demo.settings, prayerLogs: demo.prayerLogs,
  }, 'merge');
  if (!result.success) throw new Error('تعذر حفظ بيانات العرض التجريبية.');
  const failed = store.restoreBrowserData({
    deletedProjects: [], projectRatings: { [demo.projects[1].id]: 4, [demo.projects[2].id]: 5 },
    projectPlans: { [demo.projects[1].id]: 360, [demo.projects[2].id]: 240 }, sessionPlans: {},
    libraryResources: demo.libraryResources, videoItems: demo.videoItems, notifications: demo.notifications,
  }, 'merge');
  if (failed.length) throw new Error('تعذر حفظ بعض بيانات العرض التجريبية.');
  localStorage.setItem(marker, new Date().toISOString());
  return true;
}
