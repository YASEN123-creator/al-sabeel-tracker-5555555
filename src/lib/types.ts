export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_folder: boolean;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  is_completed: boolean;
  is_recurring: boolean;
  recurring_days: number[] | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  start_time: string;
  end_time: string | null;
  duration: number;
  session_date: string;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  project_id: string | null;
  goal_type: 'daily_hours' | 'weekly_hours' | 'daily_tasks' | 'weekly_tasks';
  target_value: number;
  goal_kind?: 'metric' | 'general';
  title?: string | null;
  description?: string | null;
  target_date?: string | null;
  is_completed?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  enable_pomodoro: boolean;
  enable_goals: boolean;
  enable_analytics: boolean;
  pomodoro_work_duration: number;
  pomodoro_break_duration: number;
  adhan_enabled: boolean;
  alarm_sound: string;
  custom_alarm_data: string;
  created_at: string;
  updated_at: string;
}

export interface DeletedProject {
  project: Project;
  deletedAt: string;
}

export interface LibraryResource {
  id: string;
  name: string;
  type: 'book' | 'article' | 'pdf' | 'link' | 'note' | 'other';
  category: string;
  url: string;
  description: string;
  createdAt: string;
}

export interface VideoItem {
  id: string;
  name: string;
  category: string;
  url: string;
  duration: string;
  description: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'timer' | 'task' | 'goal' | 'streak' | 'resource' | 'video' | 'info' | 'prayer';
  read: boolean;
  createdAt: string;
}

export interface PrayerLog {
  id: string;
  user_id: string;
  log_date: string;
  fajr: boolean;
  dhuhr: boolean;
  asr: boolean;
  maghrib: boolean;
  isha: boolean;
  fajr_sunnah: boolean;
  dhuhr_sunnah: boolean;
  asr_sunnah: boolean;
  maghrib_sunnah: boolean;
  isha_sunnah: boolean;
  quran_pages: number;
  quran_notes: string;
  fajr_status: PrayerStatus | null;
  dhuhr_status: PrayerStatus | null;
  asr_status: PrayerStatus | null;
  maghrib_status: PrayerStatus | null;
  isha_status: PrayerStatus | null;
  quran_surahs: string[];
  custom_worships: CustomWorship[];
  created_at: string;
  updated_at: string;
}

export type PrayerLogPayload = Omit<PrayerLog, 'id' | 'created_at' | 'updated_at'>;

export type ActiveView = 'dashboard' | 'projects' | 'tasks' | 'sessions' | 'analytics' | 'charts' | 'goals' | 'settings' | 'library' | 'notifications' | 'video' | 'prayers';

export type QuickCreate = 'project' | 'task' | 'session' | 'goal' | 'prayer';

export type TimerState = 'idle' | 'running' | 'paused' | 'break';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  actionLabel?: string;
  onAction?: () => void;
}

export type PrayerStatus = 'mosque' | 'home' | 'late' | 'missed';

export interface CustomWorship {
  id: string;
  name: string;
  category: string;
  target: number;
  unit: string;
  log_date: string;
  value: number;
  notes: string;
}

export type QuranSurah = {
  number: number;
  name: string;
  nameEn: string;
  verses: number;
};

export const QURAN_SURAHS: QuranSurah[] = [
  { number: 1, name: 'الفاتحة', nameEn: 'Al-Fatiha', verses: 7 },
  { number: 2, name: 'البقرة', nameEn: 'Al-Baqarah', verses: 286 },
  { number: 3, name: 'آل عمران', nameEn: 'Aal-Imran', verses: 200 },
  { number: 4, name: 'النساء', nameEn: 'An-Nisa', verses: 176 },
  { number: 5, name: 'المائدة', nameEn: 'Al-Maida', verses: 120 },
  { number: 6, name: 'الأنعام', nameEn: 'Al-Anam', verses: 165 },
  { number: 7, name: 'الأعراف', nameEn: 'Al-Araf', verses: 206 },
  { number: 8, name: 'الأنفال', nameEn: 'Al-Anfal', verses: 75 },
  { number: 9, name: 'التوبة', nameEn: 'At-Tawbah', verses: 129 },
  { number: 10, name: 'يونس', nameEn: 'Yunus', verses: 109 },
  { number: 11, name: 'هود', nameEn: 'Hud', verses: 123 },
  { number: 12, name: 'يوسف', nameEn: 'Yusuf', verses: 111 },
  { number: 13, name: 'الرعد', nameEn: 'Ar-Rad', verses: 43 },
  { number: 14, name: 'إبراهيم', nameEn: 'Ibrahim', verses: 52 },
  { number: 15, name: 'الحجر', nameEn: 'Al-Hijr', verses: 99 },
  { number: 16, name: 'النحل', nameEn: 'An-Nahl', verses: 128 },
  { number: 17, name: 'الإسراء', nameEn: 'Al-Isra', verses: 111 },
  { number: 18, name: 'الكهف', nameEn: 'Al-Kahf', verses: 110 },
  { number: 19, name: 'مريم', nameEn: 'Maryam', verses: 98 },
  { number: 20, name: 'طه', nameEn: 'Ta-Ha', verses: 135 },
  { number: 21, name: 'الأنبياء', nameEn: 'Al-Anbiya', verses: 112 },
  { number: 22, name: 'الحج', nameEn: 'Al-Hajj', verses: 78 },
  { number: 23, name: 'المؤمنون', nameEn: 'Al-Muminun', verses: 118 },
  { number: 24, name: 'النور', nameEn: 'An-Nur', verses: 64 },
  { number: 25, name: 'الفرقان', nameEn: 'Al-Furqan', verses: 77 },
  { number: 26, name: 'الشعراء', nameEn: 'Ash-Shuara', verses: 227 },
  { number: 27, name: 'النمل', nameEn: 'An-Naml', verses: 93 },
  { number: 28, name: 'القصص', nameEn: 'Al-Qasas', verses: 88 },
  { number: 29, name: 'العنكبوت', nameEn: 'Al-Ankabut', verses: 69 },
  { number: 30, name: 'الروم', nameEn: 'Ar-Rum', verses: 60 },
  { number: 31, name: 'لقمان', nameEn: 'Luqman', verses: 34 },
  { number: 32, name: 'السجدة', nameEn: 'As-Sajdah', verses: 30 },
  { number: 33, name: 'الأحزاب', nameEn: 'Al-Ahzab', verses: 73 },
  { number: 34, name: 'سبأ', nameEn: 'Saba', verses: 54 },
  { number: 35, name: 'فاطر', nameEn: 'Fatir', verses: 45 },
  { number: 36, name: 'يس', nameEn: 'Ya-Sin', verses: 83 },
  { number: 37, name: 'الصافات', nameEn: 'As-Saffat', verses: 182 },
  { number: 38, name: 'ص', nameEn: 'Sad', verses: 88 },
  { number: 39, name: 'الزمر', nameEn: 'Az-Zumar', verses: 75 },
  { number: 40, name: 'غافر', nameEn: 'Ghafir', verses: 85 },
  { number: 41, name: 'فصلت', nameEn: 'Fussilat', verses: 54 },
  { number: 42, name: 'الشورى', nameEn: 'Ash-Shura', verses: 53 },
  { number: 43, name: 'الزخرف', nameEn: 'Az-Zukhruf', verses: 89 },
  { number: 44, name: 'الدخان', nameEn: 'Ad-Dukhan', verses: 59 },
  { number: 45, name: 'الجاثية', nameEn: 'Al-Jathiya', verses: 37 },
  { number: 46, name: 'الأحقاف', nameEn: 'Al-Ahqaf', verses: 35 },
  { number: 47, name: 'محمد', nameEn: 'Muhammad', verses: 38 },
  { number: 48, name: 'الفتح', nameEn: 'Al-Fath', verses: 29 },
  { number: 49, name: 'الحجرات', nameEn: 'Al-Hujurat', verses: 18 },
  { number: 50, name: 'ق', nameEn: 'Qaf', verses: 45 },
  { number: 51, name: 'الذاريات', nameEn: 'Adh-Dhariyat', verses: 60 },
  { number: 52, name: 'الطور', nameEn: 'At-Tur', verses: 49 },
  { number: 53, name: 'النجم', nameEn: 'An-Najm', verses: 62 },
  { number: 54, name: 'القمر', nameEn: 'Al-Qamar', verses: 55 },
  { number: 55, name: 'الرحمن', nameEn: 'Ar-Rahman', verses: 78 },
  { number: 56, name: 'الواقعة', nameEn: 'Al-Waqia', verses: 96 },
  { number: 57, name: 'الحديد', nameEn: 'Al-Hadid', verses: 29 },
  { number: 58, name: 'المجادلة', nameEn: 'Al-Mujadila', verses: 22 },
  { number: 59, name: 'الحشر', nameEn: 'Al-Hashr', verses: 24 },
  { number: 60, name: 'الممتحنة', nameEn: 'Al-Mumtahina', verses: 13 },
  { number: 61, name: 'الصف', nameEn: 'As-Saff', verses: 14 },
  { number: 62, name: 'الجمعة', nameEn: 'Al-Jumuah', verses: 11 },
  { number: 63, name: 'المنافقون', nameEn: 'Al-Munafiqun', verses: 11 },
  { number: 64, name: 'التغابن', nameEn: 'At-Taghabun', verses: 18 },
  { number: 65, name: 'الطلاق', nameEn: 'At-Talaq', verses: 12 },
  { number: 66, name: 'التحريم', nameEn: 'At-Tahrim', verses: 12 },
  { number: 67, name: 'الملك', nameEn: 'Al-Mulk', verses: 30 },
  { number: 68, name: 'القلم', nameEn: 'Al-Qalam', verses: 52 },
  { number: 69, name: 'الحاقة', nameEn: 'Al-Haqqah', verses: 52 },
  { number: 70, name: 'المعارج', nameEn: 'Al-Maarij', verses: 44 },
  { number: 71, name: 'نوح', nameEn: 'Nuh', verses: 28 },
  { number: 72, name: 'الجن', nameEn: 'Al-Jinn', verses: 28 },
  { number: 73, name: 'المزمل', nameEn: 'Al-Muzzammil', verses: 20 },
  { number: 74, name: 'المدثر', nameEn: 'Al-Muddathir', verses: 56 },
  { number: 75, name: 'القيامة', nameEn: 'Al-Qiyamah', verses: 40 },
  { number: 76, name: 'الإنسان', nameEn: 'Al-Insan', verses: 31 },
  { number: 77, name: 'المرسلات', nameEn: 'Al-Mursalat', verses: 50 },
  { number: 78, name: 'النبأ', nameEn: 'An-Naba', verses: 40 },
  { number: 79, name: 'النازعات', nameEn: 'An-Naziat', verses: 46 },
  { number: 80, name: 'عبس', nameEn: 'Abasa', verses: 42 },
  { number: 81, name: 'التكوير', nameEn: 'At-Takwir', verses: 29 },
  { number: 82, name: 'الانفطار', nameEn: 'Al-Infitar', verses: 19 },
  { number: 83, name: 'المطففين', nameEn: 'Al-Mutaffifin', verses: 36 },
  { number: 84, name: 'الانشقاق', nameEn: 'Al-Inshiqaq', verses: 25 },
  { number: 85, name: 'البروج', nameEn: 'Al-Buruj', verses: 22 },
  { number: 86, name: 'الطارق', nameEn: 'At-Tariq', verses: 17 },
  { number: 87, name: 'الأعلى', nameEn: 'Al-Ala', verses: 19 },
  { number: 88, name: 'الغاشية', nameEn: 'Al-Ghashiyah', verses: 26 },
  { number: 89, name: 'الفجر', nameEn: 'Al-Fajr', verses: 30 },
  { number: 90, name: 'البلد', nameEn: 'Al-Balad', verses: 20 },
  { number: 91, name: 'الشمس', nameEn: 'Ash-Shams', verses: 15 },
  { number: 92, name: 'الليل', nameEn: 'Al-Layl', verses: 21 },
  { number: 93, name: 'الضحى', nameEn: 'Ad-Duha', verses: 11 },
  { number: 94, name: 'الشرح', nameEn: 'Ash-Sharh', verses: 8 },
  { number: 95, name: 'التين', nameEn: 'At-Tin', verses: 8 },
  { number: 96, name: 'العلق', nameEn: 'Al-Alaq', verses: 19 },
  { number: 97, name: 'القدر', nameEn: 'Al-Qadr', verses: 5 },
  { number: 98, name: 'البينة', nameEn: 'Al-Bayyinah', verses: 8 },
  { number: 99, name: 'الزلزلة', nameEn: 'Az-Zalzalah', verses: 8 },
  { number: 100, name: 'العاديات', nameEn: 'Al-Adiyat', verses: 11 },
  { number: 101, name: 'القارعة', nameEn: 'Al-Qariah', verses: 11 },
  { number: 102, name: 'التكاثر', nameEn: 'At-Takathur', verses: 8 },
  { number: 103, name: 'العصر', nameEn: 'Al-Asr', verses: 3 },
  { number: 104, name: 'الهمزة', nameEn: 'Al-Humazah', verses: 9 },
  { number: 105, name: 'الفيل', nameEn: 'Al-Fil', verses: 5 },
  { number: 106, name: 'قريش', nameEn: 'Quraysh', verses: 4 },
  { number: 107, name: 'الماعون', nameEn: 'Al-Maun', verses: 7 },
  { number: 108, name: 'الكوثر', nameEn: 'Al-Kawthar', verses: 3 },
  { number: 109, name: 'الكافرون', nameEn: 'Al-Kafirun', verses: 6 },
  { number: 110, name: 'النصر', nameEn: 'An-Nasr', verses: 3 },
  { number: 111, name: 'المسد', nameEn: 'Al-Masad', verses: 5 },
  { number: 112, name: 'الإخلاص', nameEn: 'Al-Ikhlas', verses: 4 },
  { number: 113, name: 'الفلق', nameEn: 'Al-Falaq', verses: 5 },
  { number: 114, name: 'الناس', nameEn: 'An-Nas', verses: 6 },
];
