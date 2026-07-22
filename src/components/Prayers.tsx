'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Circle,
  ChevronLeft,
  ChevronRight,
  Flame,
  BookOpen,
  Star,
  Clock,
  Calendar,
  TrendingUp,
  Save,
  BarChart3,
  Plus,
  Trash2,
  X,
  Search,
  Heart,
  Filter,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { upsertPrayerLog, fetchPrayerLogs } from '@/lib/api';
import type { PrayerLog, PrayerLogPayload } from '@/lib/types';
import type { PrayerStatus, CustomWorship } from '@/lib/types';
import { QURAN_SURAHS } from '@/lib/types';
import { SkeletonList } from '@/components/Skeleton';
import { useShallow } from '@/lib/useAppShallow';
import { parseLocalDate, toLocalDateKey as formatDateKey } from '@/lib/localDate';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateArabic(date: Date): string {
  return date.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

type MainPrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
type MainPrayerStatusKey = `${MainPrayerKey}_status`;

function getPrayerStatus(log: PrayerLog | PrayerLogPayload | null, key: MainPrayerKey): PrayerStatus | null {
  if (!log) return null;
  const status = log[`${key}_status` as MainPrayerStatusKey];
  if (status) return status;
  const boolVal = log[key];
  if (boolVal) return 'home';
  return null;
}

const MAIN_PRAYERS = [
  { key: 'fajr', tKey: 'prayers.fajr', icon: '🌅' },
  { key: 'dhuhr', tKey: 'prayers.dhuhr', icon: '☀️' },
  { key: 'asr', tKey: 'prayers.asr', icon: '🌤️' },
  { key: 'maghrib', tKey: 'prayers.maghrib', icon: '🌇' },
  { key: 'isha', tKey: 'prayers.isha', icon: '🌙' },
] as const;

const SUNNAH_PRAYERS = [
  { key: 'fajr_sunnah', tKey: 'prayers.fajrSunnah' },
  { key: 'dhuhr_sunnah', tKey: 'prayers.dhuhrSunnah' },
  { key: 'asr_sunnah', tKey: 'prayers.asrSunnah' },
  { key: 'maghrib_sunnah', tKey: 'prayers.maghribSunnah' },
  { key: 'isha_sunnah', tKey: 'prayers.ishaSunnah' },
] as const;

const PRAYER_STATUSES: { value: PrayerStatus; emoji: string; labelAr: string; labelEn: string; color: string }[] = [
  { value: 'mosque', emoji: '🕌', labelAr: 'مسجد', labelEn: 'Mosque', color: 'green' },
  { value: 'home', emoji: '🏠', labelAr: 'بيت', labelEn: 'Home', color: 'blue' },
  { value: 'late', emoji: '⏰', labelAr: 'متأخر', labelEn: 'Late', color: 'orange' },
  { value: 'missed', emoji: '❌', labelAr: 'فات', labelEn: 'Missed', color: 'red' },
];

const PRAYER_STATUS_TONES: Record<PrayerStatus, string> = {
  mosque: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  home: 'bg-blue-100 text-blue-800 ring-1 ring-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
  late: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  missed: 'bg-rose-100 text-rose-800 ring-1 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
};

type PrayerField =
  | 'fajr'
  | 'dhuhr'
  | 'asr'
  | 'maghrib'
  | 'isha'
  | 'fajr_sunnah'
  | 'dhuhr_sunnah'
  | 'asr_sunnah'
  | 'maghrib_sunnah'
  | 'isha_sunnah';

type FilterType = 'day' | 'month' | 'year' | 'all';

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function createEmptyLog(userId: string, logDate: string): PrayerLogPayload {
  return {
    user_id: userId,
    log_date: logDate,
    fajr: false,
    dhuhr: false,
    asr: false,
    maghrib: false,
    isha: false,
    fajr_sunnah: false,
    dhuhr_sunnah: false,
    asr_sunnah: false,
    maghrib_sunnah: false,
    isha_sunnah: false,
    quran_pages: 0,
    quran_notes: '',
    fajr_status: null,
    dhuhr_status: null,
    asr_status: null,
    maghrib_status: null,
    isha_status: null,
    quran_surahs: [],
    custom_worships: [],
  };
}

function buildPayload(userId: string, key: string, existing: PrayerLog | null, overrides: Partial<PrayerLogPayload>): PrayerLogPayload {
  const baseData = createEmptyLog(userId, key);
  return {
    ...baseData,
    ...(existing
      ? {
          fajr: existing.fajr,
          dhuhr: existing.dhuhr,
          asr: existing.asr,
          maghrib: existing.maghrib,
          isha: existing.isha,
          fajr_sunnah: existing.fajr_sunnah,
          dhuhr_sunnah: existing.dhuhr_sunnah,
          asr_sunnah: existing.asr_sunnah,
          maghrib_sunnah: existing.maghrib_sunnah,
          isha_sunnah: existing.isha_sunnah,
          quran_pages: existing.quran_pages,
          quran_notes: existing.quran_notes,
          fajr_status: existing.fajr_status,
          dhuhr_status: existing.dhuhr_status,
          asr_status: existing.asr_status,
          maghrib_status: existing.maghrib_status,
          isha_status: existing.isha_status,
          quran_surahs: existing.quran_surahs,
          custom_worships: existing.custom_worships,
        }
      : {}),
    ...overrides,
  };
}

// ── Prayer Status Selector ────────────────────────────────────────────────────

function PrayerStatusSelector({
  label,
  emoji,
  currentStatus,
  onStatusChange,
  delay = 0,
  disabled,
}: {
  label: string;
  emoji?: string;
  currentStatus: PrayerStatus | null;
  onStatusChange: (status: PrayerStatus) => void;
  delay?: number;
  disabled?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`p-3.5 rounded-xl border transition-all duration-200 ${
        disabled ? 'pointer-events-none opacity-60' : ''
      } ${
        currentStatus
          ? currentStatus === 'mosque'
            ? 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800'
            : currentStatus === 'home'
            ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
            : currentStatus === 'late'
            ? 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800'
            : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800'
          : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-2 mb-2.5">
        {emoji && <span className="text-lg">{emoji}</span>}
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {PRAYER_STATUSES.map((ps) => {
          const isSelected = currentStatus === ps.value;
          return (
            <motion.button
              key={ps.value}
              whileTap={{ scale: 0.92 }}
              onClick={() => onStatusChange(ps.value)}
              className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-center transition-all duration-200 cursor-pointer ${
                isSelected
                  ? ps.color === 'green'
                    ? 'bg-green-500 dark:bg-green-600 text-white shadow-sm shadow-green-500/30'
                    : ps.color === 'blue'
                    ? 'bg-blue-500 dark:bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : ps.color === 'orange'
                    ? 'bg-orange-500 dark:bg-orange-600 text-white shadow-sm shadow-orange-500/30'
                    : 'bg-red-500 dark:bg-red-600 text-white shadow-sm shadow-red-500/30'
                  : 'bg-gray-100 dark:bg-slate-700/70 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600/70'
              }`}
            >
              <span className="text-sm leading-none">{ps.emoji}</span>
              <span className="text-[10px] font-medium leading-tight mt-0.5">
                {label === 'Fajr' || label === 'Dhuhr' || label === 'Asr' || label === 'Maghrib' || label === 'Isha' || label === 'Fajr ' || label === 'Dhuhr ' || label === 'Asr ' || label === 'Maghrib ' || label === 'Isha '
                  ? ps.labelEn
                  : ps.labelAr}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Prayer Toggle Button (still used for Sunnah) ─────────────────────────────

function PrayerToggle({
  label,
  emoji,
  prayed,
  onToggle,
  delay = 0,
}: {
  label: string;
  emoji?: string;
  prayed: boolean;
  onToggle: () => void;
  delay?: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileTap={{ scale: 0.96 }}
      onClick={onToggle}
      className={`flex items-center gap-3 w-full p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
        prayed
          ? 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800'
          : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700/60'
      }`}
    >
      <AnimatePresence mode="wait">
        {prayed ? (
          <motion.div
            key="checked"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="w-9 h-9 rounded-full bg-green-500 dark:bg-green-600 flex items-center justify-center flex-shrink-0"
          >
            <Check size={18} className="text-white" strokeWidth={3} />
          </motion.div>
        ) : (
          <motion.div
            key="unchecked"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="w-9 h-9 rounded-full border-2 border-gray-300 dark:border-slate-600 flex items-center justify-center flex-shrink-0"
          >
            <Circle size={16} className="text-gray-300 dark:text-slate-600" />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {emoji && <span className="text-lg">{emoji}</span>}
        <span
          className={`text-sm font-semibold truncate ${
            prayed ? 'text-green-700 dark:text-green-300' : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          {label}
        </span>
      </div>
      <span
        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
          prayed
            ? 'bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300'
            : 'bg-gray-200/70 dark:bg-slate-700/60 text-gray-400 dark:text-gray-500'
        }`}
      >
        {prayed ? '✓' : '–'}
      </span>
    </motion.button>
  );
}

// ── Stats Card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 flex flex-col items-center gap-2 text-center">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          accent || 'bg-slate-100 dark:bg-slate-700'
        }`}
      >
        <Icon
          size={20}
          className={accent ? 'text-white' : 'text-slate-600 dark:text-slate-300'}
        />
      </div>
      <span className="text-xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
        {value}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
        {label}
      </span>
    </div>
  );
}

// ── History Row ──────────────────────────────────────────────────────────────

function HistoryRow({
  log,
  t,
  onClick,
}: {
  log: PrayerLog;
  t: (key: string) => string;
  onClick: () => void;
}) {
  const prayerKeys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
  let mainCount = 0;
  prayerKeys.forEach((pk) => {
    const status = getPrayerStatus(log, pk);
    if (status && status !== 'missed') mainCount++;
    else if (!status && log[pk]) mainCount++;
  });
  const allDone = mainCount === 5;
  const someDone = mainCount > 0;

  const borderColor = allDone
    ? 'border-l-green-500 dark:border-l-green-400'
    : someDone
    ? 'border-l-yellow-400 dark:border-l-yellow-500'
    : 'border-l-red-400 dark:border-l-red-500';

  const bgColor = allDone
    ? 'bg-green-50/50 dark:bg-green-950/20'
    : someDone
    ? 'bg-yellow-50/40 dark:bg-yellow-950/10'
    : 'bg-red-50/40 dark:bg-red-950/10';

  return (
    <motion.div
      whileHover={{ scale: 1.008 }}
      onClick={onClick}
      className={`flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 dark:border-slate-700 border-l-4 cursor-pointer transition-colors ${borderColor} ${bgColor}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
          {log.log_date}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {mainCount}/5 {t('prayers.completedPrayers').split(' ').pop() || 'صلوات'}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <BookOpen size={13} className="text-gray-400 dark:text-gray-500" />
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          {log.quran_pages} {t('prayers.pages')}
        </span>
      </div>
      <div
        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
          allDone ? 'bg-green-500' : someDone ? 'bg-yellow-400' : 'bg-red-400'
        }`}
      />
    </motion.div>
  );
}

// ── Surah Selector ───────────────────────────────────────────────────────────

function SurahSelector({
  selectedSurahs,
  onAdd,
  onRemove,
  lang,
}: {
  selectedSurahs: string[];
  onAdd: (surahName: string) => void;
  onRemove: (surahName: string) => void;
  lang: string;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAr = lang === 'ar';

  const filtered = useMemo(() => {
    if (!search.trim()) return QURAN_SURAHS.slice(0, 20);
    const q = search.toLowerCase();
    return QURAN_SURAHS.filter(
      (s) =>
        s.name.includes(search) ||
        s.nameEn.toLowerCase().includes(q) ||
        String(s.number) === search
    );
  }, [search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref}>
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 focus-within:border-blue-400 dark:focus-within:border-blue-500">
          <Search size={15} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={isAr ? 'ابحث عن سورة...' : 'Search surah...'}
            className="flex-1 bg-transparent text-sm outline-none text-slate-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>

        <AnimatePresence>
          {isOpen && filtered.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg max-h-48 overflow-y-auto"
            >
              {filtered.map((surah) => {
                const isSelected = selectedSurahs.includes(surah.name);
                return (
                  <button
                    key={surah.number}
                    onClick={() => {
                      if (!isSelected) onAdd(surah.name);
                      setSearch('');
                      setIsOpen(false);
                    }}
                    disabled={isSelected}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-right transition-colors ${
                      isSelected
                        ? 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 cursor-pointer'
                    }`}
                  >
                    <span className="w-7 text-center text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                      {surah.number}
                    </span>
                    <span className="flex-1 truncate">{surah.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                      {surah.nameEn}
                    </span>
                    {isSelected && <Check size={14} className="text-green-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selected chips */}
      {selectedSurahs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedSurahs.map((name) => (
            <motion.span
              key={name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-medium"
            >
              {name}
              <button
                onClick={() => onRemove(name)}
                className="hover:text-red-500 transition-colors cursor-pointer"
              >
                <X size={12} />
              </button>
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Custom Worship Section ───────────────────────────────────────────────────

function CustomWorshipSection({
  worships,
  onSave,
  lang,
}: {
  worships: CustomWorship[];
  onSave: (worships: CustomWorship[]) => void;
  lang: string;
}) {
  const isAr = lang === 'ar';
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');

  const UNITS = isAr
    ? ['مرة', 'دقيقة', 'صفحة', 'جزء', 'ساعة', 'كيلوغرام', 'ريال']
    : ['times', 'minutes', 'pages', 'juz', 'hours', 'kg', 'SAR'];

  const handleAdd = () => {
    if (!name.trim() || !value.trim()) return;
    const newWorship: CustomWorship = {
      id: crypto.randomUUID(),
      name: name.trim(),
      category: 'custom',
      target: 0,
      unit: unit.trim() || (isAr ? 'مرة' : 'times'),
      log_date: '',
      value: parseFloat(value) || 0,
      notes: notes.trim(),
    };
    onSave([...worships, newWorship]);
    setName('');
    setValue('');
    setUnit('');
    setNotes('');
  };

  const handleDelete = (id: string) => {
    onSave(worships.filter((w) => w.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isAr ? 'اسم العبادة (صيام، صدقة...)' : 'Name (fasting, charity...)'}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-sm bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500"
        />
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={isAr ? 'القيمة' : 'Value'}
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-sm bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 tabular-nums"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="px-2 py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-sm bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 min-w-[80px]"
          >
            <option value="">{isAr ? 'وحدة' : 'Unit'}</option>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={isAr ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-sm bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500"
        />
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleAdd}
          disabled={!name.trim() || !value.trim()}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus size={16} />
          {isAr ? 'إضافة' : 'Add'}
        </motion.button>
      </div>

      {/* Table */}
      {worships.length > 0 ? (
        <div className="border border-gray-200 dark:border-slate-600 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50">
                  <th className="px-3 py-2.5 text-right font-medium text-slate-600 dark:text-slate-300 text-xs">
                    {isAr ? 'العبادة' : 'Worship'}
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium text-slate-600 dark:text-slate-300 text-xs">
                    {isAr ? 'القيمة' : 'Value'}
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium text-slate-600 dark:text-slate-300 text-xs">
                    {isAr ? 'الوحدة' : 'Unit'}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium text-slate-600 dark:text-slate-300 text-xs">
                    {isAr ? 'ملاحظات' : 'Notes'}
                  </th>
                  <th className="px-3 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {worships.map((w) => (
                  <tr
                    key={w.id}
                    className="border-t border-gray-100 dark:border-slate-700 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-3 py-2.5 text-slate-800 dark:text-slate-200 font-medium">
                      {w.name}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-700 dark:text-slate-300">
                      {w.value}
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400">
                      {w.unit}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                      {w.notes || '–'}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => handleDelete(w.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <Heart size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {isAr ? 'لم تُضف أي عبادات بعد' : 'No custom worships added yet'}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

function FilterBar({
  filterType,
  setFilterType,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  lang,
}: {
  filterType: FilterType;
  setFilterType: (ft: FilterType) => void;
  selectedMonth: number;
  setSelectedMonth: (m: number) => void;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  lang: string;
}) {
  const isAr = lang === 'ar';
  const now = new Date();

  const filterOptions: { value: FilterType; labelAr: string; labelEn: string }[] = [
    { value: 'day', labelAr: 'يوم', labelEn: 'Day' },
    { value: 'month', labelAr: 'شهر', labelEn: 'Month' },
    { value: 'year', labelAr: 'سنة', labelEn: 'Year' },
    { value: 'all', labelAr: 'كل الوقت', labelEn: 'All Time' },
  ];

  const currentYear = now.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Filter size={14} className="text-gray-400 dark:text-gray-500" />
        <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5 gap-0.5">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterType(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                filterType === opt.value
                  ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {isAr ? opt.labelAr : opt.labelEn}
            </button>
          ))}
        </div>
      </div>

      {filterType === 'month' && (
        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-400"
          >
            {(isAr ? ARABIC_MONTHS : ENGLISH_MONTHS).map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-400"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {filterType === 'year' && (
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-400"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      )}
    </div>
  );
}

// ── Filter logs by filter type ────────────────────────────────────────────────

function filterLogsByType(
  allLogs: PrayerLog[],
  filterType: FilterType,
  selectedMonth: number,
  selectedYear: number,
  referenceDate: Date
): PrayerLog[] {
  if (filterType === 'all') return allLogs;

  return allLogs.filter((log) => {
    const logDate = parseLocalDate(log.log_date);
    if (filterType === 'day') {
      return (
        logDate.getFullYear() === referenceDate.getFullYear() &&
        logDate.getMonth() === referenceDate.getMonth() &&
        logDate.getDate() === referenceDate.getDate()
      );
    }
    if (filterType === 'month') {
      return (
        logDate.getFullYear() === selectedYear &&
        logDate.getMonth() === selectedMonth
      );
    }
    if (filterType === 'year') {
      return logDate.getFullYear() === selectedYear;
    }
    return true;
  });
}

// ── Worship Analytics Components ──────────────────────────────────────────────


type WorshipChartView = 'prayers' | 'rawatib' | 'quran';

function UnifiedWorshipChart({
  prayerLogs,
  t,
  lang,
  view,
  onViewChange,
}: {
  prayerLogs: PrayerLog[];
  t: (key: string) => string;
  lang: string;
  view: WorshipChartView;
  onViewChange: (view: WorshipChartView) => void;
}) {
  const isAr = lang === 'ar';
  const prayerData = MAIN_PRAYERS.map((prayer) => {
    const statuses = prayerLogs.map((log) => getPrayerStatus(log, prayer.key));
    return {
      name: t(prayer.tKey),
      mosque: statuses.filter((status) => status === 'mosque').length,
      home: statuses.filter((status) => status === 'home').length,
      late: statuses.filter((status) => status === 'late').length,
      missed: statuses.filter((status) => status === 'missed').length,
    };
  });
  const rawatibData = SUNNAH_PRAYERS.map((prayer) => ({
    name: t(prayer.tKey),
    value: prayerLogs.length ? Math.round((prayerLogs.filter((log) => Boolean(log[prayer.key])).length / prayerLogs.length) * 100) : 0,
  }));
  const quranData = [...prayerLogs]
    .sort((left, right) => left.log_date.localeCompare(right.log_date))
    .slice(-31)
    .map((log) => ({ name: log.log_date.slice(5), pages: log.quran_pages || 0 }));
  const views: Array<{ value: WorshipChartView; ar: string; en: string }> = [
    { value: 'prayers', ar: 'الصلوات', en: 'Prayers' },
    { value: 'rawatib', ar: 'السنن الرواتب', en: 'Rawatib' },
    { value: 'quran', ar: 'القرآن', en: 'Quran' },
  ];

  return <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 dark:border-[#26334a] dark:bg-[#0d1422] sm:p-5">
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div><h3 className="font-black text-slate-900 dark:text-white">{isAr ? 'تحليل العبادات' : 'Worship analysis'}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{isAr ? 'جراف واحد يتغير حسب النوع المختار' : 'One chart that changes with the selected category'}</p></div>
      <div className="inline-flex w-fit rounded-xl bg-slate-100 p-1 dark:bg-slate-800">{views.map((item) => <button type="button" key={item.value} onClick={() => onViewChange(item.value)} className={`h-9 rounded-lg px-4 text-xs font-black transition ${view === item.value ? 'bg-white text-violet-700 shadow-sm dark:bg-violet-600 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-300'}`}>{isAr ? item.ar : item.en}</button>)}</div>
    </div>
    {view === 'prayers' && <div className="mb-3 flex flex-wrap gap-3 text-xs font-bold"><span className="text-emerald-600">● {isAr ? 'في المسجد — الأفضل' : 'Mosque — best'}</span><span className="text-blue-600">● {isAr ? 'في البيت' : 'At home'}</span><span className="text-amber-600">● {isAr ? 'متأخر' : 'Late'}</span><span className="text-rose-600">● {isAr ? 'فاتت' : 'Missed'}</span></div>}
    <div className="h-[330px] min-w-0">
      {view === 'prayers' ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}><BarChart data={prayerData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} /><Bar dataKey="mosque" stackId="status" fill="#16a34a" radius={[6, 6, 0, 0]} /><Bar dataKey="home" stackId="status" fill="#3b82f6" /><Bar dataKey="late" stackId="status" fill="#f59e0b" /><Bar dataKey="missed" stackId="status" fill="#f43f5e" /></BarChart></ResponsiveContainer>
        : view === 'rawatib' ? <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}><BarChart data={rawatibData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => `${value}%`} contentStyle={{ borderRadius: 12, fontSize: 12 }} /><Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} maxBarSize={54} /></BarChart></ResponsiveContainer>
        : <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}><LineChart data={quranData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} /><Line type="monotone" dataKey="pages" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer>}
    </div>
  </div>;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function Prayers() {
  const t = useT();
  const lang = useAppStore((s) => s.language || 'ar');
  const isAr = lang === 'ar';
  const {
    userId, prayerLogs, setPrayerLogs, addPrayerLog,
    updatePrayerLog: updateLogInStore, addToast, dataLoading,
  } = useAppStore(useShallow((state) => ({
    userId: state.userId,
    prayerLogs: state.prayerLogs,
    setPrayerLogs: state.setPrayerLogs,
    addPrayerLog: state.addPrayerLog,
    updatePrayerLog: state.updatePrayerLog,
    addToast: state.addToast,
    dataLoading: state.dataLoading,
  })));

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [quranPages, setQuranPages] = useState<string>('0');
  const [quranNotes, setQuranNotes] = useState('');
  const [localSelectedSurahs, setLocalSelectedSurahs] = useState<string[]>([]);
  const [localWorships, setLocalWorships] = useState<CustomWorship[]>([]);
  const [savingQuran, setSavingQuran] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);
  const [togglingField, setTogglingField] = useState<PrayerField | null>(null);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [chartView, setChartView] = useState<WorshipChartView>('prayers');

  // Analytics filter state
  const [filterType, setFilterType] = useState<FilterType>('all');
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // ── Fetch on mount ──
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const logs = await fetchPrayerLogs(userId);
        if (!cancelled) {
          setPrayerLogs(logs);
          setLocalLoading(false);
        }
      } catch {
        if (!cancelled) setLocalLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, setPrayerLogs]);

  // ── Reset local state when selected date changes ──
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const key = formatDateKey(selectedDate);
      const existing = prayerLogs.find((l) => l.log_date === key);
      setQuranPages(String(existing?.quran_pages || 0));
      setQuranNotes(existing?.quran_notes || '');
      setLocalSelectedSurahs(existing?.quran_surahs || []);
      setLocalWorships(existing?.custom_worships || []);
    });
    return () => { cancelled = true; };
  }, [selectedDate, prayerLogs]);

  // ── Find current log ──
  const currentLog = useMemo(() => {
    const key = formatDateKey(selectedDate);
    return prayerLogs.find((l) => l.log_date === key) || null;
  }, [selectedDate, prayerLogs]);

  // ── Handle prayer status change ──
  const handleStatusChange = useCallback(
    async (prayerKey: MainPrayerKey, status: PrayerStatus) => {
      if (!userId) return;
      setSavingStatus(prayerKey);
      try {
        const key = formatDateKey(selectedDate);
        const existing = prayerLogs.find((l) => l.log_date === key);
        const boolVal = status !== 'missed';

        const overrides: Partial<PrayerLogPayload> = {
          [prayerKey]: boolVal,
          [`${prayerKey}_status`]: status,
        };

        const payload = buildPayload(userId, key, existing, overrides);
        const result = await upsertPrayerLog(userId, payload);

        if (existing) {
          updateLogInStore(result);
        } else {
          addPrayerLog(result);
        }

        // Check if all 5 prayers just completed
        const newCount = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].filter(
          (pk) => {
            const st = getPrayerStatus(payload, pk as MainPrayerKey);
            return st && st !== 'missed';
          }
        ).length;
        if (newCount === 5) {
          useAppStore.getState().addToast(t('prayers.allPrayersCompleted'), 'success');
        }
      } catch {
        useAppStore.getState().addToast(t('toast.error'), 'error');
      } finally {
        setSavingStatus(null);
      }
    },
    [userId, selectedDate, prayerLogs, addPrayerLog, updateLogInStore, t]
  );

  // ── Toggle sunnah prayer field ──
  const handleToggle = useCallback(
    async (field: PrayerField) => {
      if (!userId) return;
      setTogglingField(field);
      try {
        const key = formatDateKey(selectedDate);
        const existing = prayerLogs.find((l) => l.log_date === key);
        const currentValue = existing ? existing[field] : false;

        const overrides: Partial<PrayerLogPayload> = {
          [field]: !currentValue,
        };

        const payload = buildPayload(userId, key, existing, overrides);
        const result = await upsertPrayerLog(userId, payload);

        if (existing) {
          updateLogInStore(result);
        } else {
          addPrayerLog(result);
        }
      } catch {
        useAppStore.getState().addToast(t('toast.error'), 'error');
      } finally {
        setTogglingField(null);
      }
    },
    [userId, selectedDate, prayerLogs, addPrayerLog, updateLogInStore, t]
  );

  // ── Save Quran (pages, notes, surahs) ──
  const handleSaveQuran = useCallback(async () => {
    if (!userId) return;
    setSavingQuran(true);
    try {
      const key = formatDateKey(selectedDate);
      const existing = prayerLogs.find((l) => l.log_date === key);

      const overrides: Partial<PrayerLogPayload> = {
        quran_pages: Math.max(0, parseInt(quranPages, 10) || 0),
        quran_notes: quranNotes.trim(),
        quran_surahs: localSelectedSurahs,
      };

      const payload = buildPayload(userId, key, existing, overrides);
      const result = await upsertPrayerLog(userId, payload);

      if (existing) {
        updateLogInStore(result);
      } else {
        addPrayerLog(result);
      }
      addToast(t('prayers.saved'), 'success');
    } catch {
      addToast(t('toast.error'), 'error');
    } finally {
      setSavingQuran(false);
    }
  }, [userId, selectedDate, prayerLogs, quranPages, quranNotes, localSelectedSurahs, addPrayerLog, updateLogInStore, addToast, t]);

  // ── Save Custom Worships ──
  const handleSaveWorships = useCallback(
    async (newWorships: CustomWorship[]) => {
      if (!userId) return;
      setLocalWorships(newWorships);
      try {
        const key = formatDateKey(selectedDate);
        const existing = prayerLogs.find((l) => l.log_date === key);

        const overrides: Partial<PrayerLogPayload> = {
          custom_worships: newWorships,
        };

        const payload = buildPayload(userId, key, existing, overrides);
        const result = await upsertPrayerLog(userId, payload);

        if (existing) {
          updateLogInStore(result);
        } else {
          addPrayerLog(result);
        }
      } catch {
        useAppStore.getState().addToast(t('toast.error'), 'error');
      }
    },
    [userId, selectedDate, prayerLogs, addPrayerLog, updateLogInStore, t]
  );

  // ── Surah management ──
  const handleAddSurah = useCallback((surahName: string) => {
    setLocalSelectedSurahs((prev) => {
      if (prev.includes(surahName)) return prev;
      return [...prev, surahName];
    });
  }, []);

  const handleRemoveSurah = useCallback((surahName: string) => {
    setLocalSelectedSurahs((prev) => prev.filter((s) => s !== surahName));
  }, []);

  // ── Date navigation ──
  const goPrevDay = useCallback(() => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);

  const goNextDay = useCallback(() => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, []);

  const goToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  // ── Derived stats ──
  const stats = useMemo(() => {
    if (prayerLogs.length === 0) {
      return { streak: 0, totalDays: 0, totalPrayers: 0, totalSunnah: 0, totalQuranPages: 0, completionRate: 0 };
    }

    const sorted = [...prayerLogs].sort(
      (a, b) => parseLocalDate(b.log_date).getTime() - parseLocalDate(a.log_date).getTime()
    );
    const mainPrayerKeys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

    let streak = 0;
    for (let i = 0; i < sorted.length; i++) {
      const log = sorted[i];
      const count = mainPrayerKeys.filter((pk) => {
        const st = getPrayerStatus(log, pk);
        return st && st !== 'missed';
      }).length;
      if (count === 5) {
        streak++;
      } else {
        break;
      }
    }

    const totalDays = sorted.length;
    const totalPrayers = sorted.reduce((sum, l) => {
      return (
        sum +
        mainPrayerKeys.filter((pk) => {
          const st = getPrayerStatus(l, pk);
          return st && st !== 'missed';
        }).length
      );
    }, 0);
    const totalSunnah = sorted.reduce(
      (sum, l) =>
        sum +
        [l.fajr_sunnah, l.dhuhr_sunnah, l.asr_sunnah, l.maghrib_sunnah, l.isha_sunnah].filter(Boolean).length,
      0
    );
    const totalQuranPages = sorted.reduce((sum, l) => sum + (l.quran_pages || 0), 0);
    const completionRate = totalDays > 0 ? Math.round((totalPrayers / (totalDays * 5)) * 100) : 0;

    return { streak, totalDays, totalPrayers, totalSunnah, totalQuranPages, completionRate };
  }, [prayerLogs]);

  // ── History: past 7 days (excluding today) ──
  const history = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    return prayerLogs
      .filter((l) => l.log_date < todayKey)
      .sort((a, b) => parseLocalDate(b.log_date).getTime() - parseLocalDate(a.log_date).getTime())
      .slice(0, 7);
  }, [prayerLogs]);

  // ── Prayer completion count for current day ──
  const currentPrayedCount = useMemo(() => {
    if (!currentLog) return 0;
    return (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).filter((pk) => {
      const st = getPrayerStatus(currentLog, pk);
      return st && st !== 'missed';
    }).length;
  }, [currentLog]);
  const allPrayedToday = currentPrayedCount === 5;

  const worshipHeatmap = useMemo(() => Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (29 - index));
    const key = formatDateKey(date);
    const log = prayerLogs.find((item) => item.log_date === key);
    const prayersDone = log ? (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).filter((prayer) => {
      const status = getPrayerStatus(log, prayer);
      return status && status !== 'missed';
    }).length : 0;
    const extras = log ? [log.fajr_sunnah, log.dhuhr_sunnah, log.asr_sunnah, log.maghrib_sunnah, log.isha_sunnah].filter(Boolean).length + (log.quran_pages > 0 ? 1 : 0) : 0;
    return { key, date, score: Math.min(4, Math.ceil(((prayersDone + Math.min(3, extras)) / 8) * 4)) };
  }), [prayerLogs]);

  // ── Filtered logs for analytics ──
  const filteredLogs = useMemo(() => {
    return filterLogsByType(prayerLogs, filterType, selectedMonth, selectedYear, selectedDate);
  }, [prayerLogs, filterType, selectedMonth, selectedYear, selectedDate]);

  // ── Loading state ──
  const isLoading = dataLoading || localLoading;

  // ── Render ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {t('prayers.title')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {t('prayers.subtitle')}
        </p>
      </div>

      {/* ── Date Navigation ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={goPrevDay}
            aria-label={t('prayers.prevDay')}
            className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
          >
            <ChevronRight size={20} className="text-slate-600 dark:text-slate-300" />
          </button>

          <div className="flex-1 text-center min-w-0">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
              {formatDateArabic(selectedDate)}
            </p>
            {isToday(selectedDate) && (
              <span className="inline-flex items-center gap-1 text-xs mt-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-medium">
                <Calendar size={11} />
                {t('prayers.today')}
              </span>
            )}
          </div>

          <button
            onClick={goNextDay}
            aria-label={t('prayers.nextDay')}
            className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
          >
            <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        {!isToday(selectedDate) && (
          <div className="flex justify-center mt-3">
            <button
              onClick={goToday}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
            >
              {t('prayers.today')}
            </button>
          </div>
        )}
      </motion.div>

      {isLoading ? (
        <SkeletonList />
      ) : (
        <>
          {/* Full-width daily worship table. It uses the same persistence handlers as the detailed controls below. */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#26334a] dark:bg-[#111a2a]">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 dark:border-[#26334a] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">{isAr ? 'جدول العبادات اليومي' : 'Daily worship table'}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{isAr ? 'سجّل عباداتك من مكان واحد، وافتح التفاصيل عند الحاجة' : 'Log everything in one place and open details only when needed'}</p>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-2 dark:bg-[#0d1422]"><span className="text-xs font-bold text-slate-500 dark:text-slate-400">{isAr ? 'إنجاز الصلاة' : 'Prayer completion'}</span><b className="text-lg text-emerald-600">{currentPrayedCount}/5</b><div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-emerald-500 transition-[width] duration-200" style={{ width: `${(currentPrayedCount / 5) * 100}%` }} /></div></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-start text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-black text-slate-500 dark:bg-[#0d1422] dark:text-slate-300"><tr><th className="px-5 py-4 text-start">{isAr ? 'العبادة' : 'Worship'}</th><th className="px-4 py-4 text-start">{isAr ? 'القسم' : 'Category'}</th><th className="px-4 py-4 text-start">{isAr ? 'الهدف' : 'Target'}</th><th className="px-4 py-4 text-start">{isAr ? 'إنجاز اليوم' : 'Today'}</th><th className="px-4 py-4 text-start">{isAr ? 'الحالة' : 'Status'}</th><th className="px-4 py-4 text-center">{isAr ? 'إجراء سريع' : 'Quick action'}</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#26334a]">
                  <tr className="bg-emerald-50/70 dark:bg-emerald-500/5"><th colSpan={6} className="px-5 py-2.5 text-start text-xs font-black text-emerald-700 dark:text-emerald-300"><span className="inline-flex items-center gap-2"><Clock size={15} />{isAr ? 'الصلاة' : 'Prayer'}</span></th></tr>
                  {MAIN_PRAYERS.map((prayer) => {
                    const status = currentLog ? getPrayerStatus(currentLog, prayer.key) : null;
                    const statusLabel = status ? PRAYER_STATUSES.find((item) => item.value === status) : null;
                    return <tr key={prayer.key} className="transition hover:bg-slate-50/80 dark:hover:bg-[#18243a]/60"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-lg dark:bg-emerald-500/10">{prayer.icon}</span><b className="text-slate-900 dark:text-white">{t(prayer.tKey)}</b></div></td><td className="px-4 py-4"><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{isAr ? 'فرض' : 'Obligatory'}</span></td><td className="px-4 py-4 font-bold text-slate-600 dark:text-slate-300">1/1</td><td className="px-4 py-4"><div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className={`h-full rounded-full ${status === 'mosque' ? 'w-full bg-emerald-500' : status === 'home' ? 'w-full bg-blue-500' : status === 'late' ? 'w-full bg-amber-500' : status === 'missed' ? 'w-full bg-rose-500' : 'w-0'}`} /></div></td><td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${status ? PRAYER_STATUS_TONES[status] : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}><i className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabel ? (isAr ? statusLabel.labelAr : statusLabel.labelEn) : (isAr ? 'لم تُسجل' : 'Not logged')}</span></td><td className="px-4 py-4"><select disabled={savingStatus === prayer.key} value={status || ''} onChange={(event) => event.target.value && handleStatusChange(prayer.key, event.target.value as PrayerStatus)} aria-label={`${isAr ? 'حالة' : 'Status'} ${t(prayer.tKey)}`} className="mx-auto block h-10 min-w-32 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-[#26334a] dark:bg-[#0d1422]"><option value="">{isAr ? 'اختر الحالة' : 'Choose status'}</option>{PRAYER_STATUSES.map((item) => <option key={item.value} value={item.value}>{isAr ? item.labelAr : item.labelEn}</option>)}</select></td></tr>;
                  })}
                  <tr className="bg-amber-50/70 dark:bg-amber-500/5"><th colSpan={6} className="px-5 py-2.5 text-start text-xs font-black text-amber-700 dark:text-amber-300"><span className="inline-flex items-center gap-2"><Star size={15} />{isAr ? 'السنن والنوافل' : 'Sunnah and voluntary worship'}</span></th></tr>
                  {SUNNAH_PRAYERS.map((sunnah) => { const done = Boolean(currentLog?.[sunnah.key]); return <tr key={sunnah.key} className="transition hover:bg-slate-50/80 dark:hover:bg-[#18243a]/60"><td className="px-5 py-4 font-bold text-slate-900 dark:text-white">{t(sunnah.tKey)}</td><td className="px-4 py-4"><span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{isAr ? 'سنة' : 'Sunnah'}</span></td><td className="px-4 py-4 text-slate-500">1</td><td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-200">{done ? '1/1' : '0/1'}</td><td className="px-4 py-4"><span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${done ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>{done ? (isAr ? 'مكتملة' : 'Completed') : (isAr ? 'لم تبدأ' : 'Not started')}</span></td><td className="px-4 py-4 text-center"><button type="button" disabled={togglingField === sunnah.key} onClick={() => handleToggle(sunnah.key as PrayerField)} aria-label={`${done ? (isAr ? 'إلغاء' : 'Undo') : (isAr ? 'إكمال' : 'Complete')} ${t(sunnah.tKey)}`} className={`mx-auto grid h-10 w-10 place-items-center rounded-xl border transition focus-visible:ring-2 focus-visible:ring-violet-500 ${done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 dark:border-[#26334a]'}`}>{done ? <Check size={18} /> : <Circle size={18} />}</button></td></tr>; })}
                  <tr className="bg-blue-50/70 dark:bg-blue-500/5"><th colSpan={6} className="px-5 py-2.5 text-start text-xs font-black text-blue-700 dark:text-blue-300"><span className="inline-flex items-center gap-2"><BookOpen size={15} />{isAr ? 'القرآن' : 'Quran'}</span></th></tr>
                  <tr className="transition hover:bg-slate-50/80 dark:hover:bg-[#18243a]/60"><td className="px-5 py-4 font-bold text-slate-900 dark:text-white">{isAr ? 'الورد اليومي' : 'Daily reading'}</td><td className="px-4 py-4"><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{isAr ? 'قراءة' : 'Reading'}</span></td><td className="px-4 py-4 text-slate-500">{isAr ? 'حسب هدفك' : 'Your target'}</td><td className="px-4 py-4 font-black text-slate-800 dark:text-white">{quranPages || 0} {isAr ? 'صفحة' : 'pages'}</td><td className="px-4 py-4"><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{localSelectedSurahs.length} {isAr ? 'سورة' : 'surahs'}</span></td><td className="px-4 py-4 text-center"><button type="button" onClick={() => document.getElementById('quran-details')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="h-10 rounded-xl border border-blue-200 px-3 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10">{isAr ? 'فتح التفاصيل' : 'Open details'}</button></td></tr>
                  {localWorships.length > 0 && <tr className="bg-violet-50/70 dark:bg-violet-500/5"><th colSpan={6} className="px-5 py-2.5 text-start text-xs font-black text-violet-700 dark:text-violet-300"><span className="inline-flex items-center gap-2"><Heart size={15} />{isAr ? 'عبادات إضافية' : 'Custom worship'}</span></th></tr>}
                  {localWorships.map((worship) => <tr key={worship.id} className="transition hover:bg-slate-50/80 dark:hover:bg-[#18243a]/60"><td className="px-5 py-4 font-bold text-slate-900 dark:text-white">{worship.name}</td><td className="px-4 py-4 text-xs text-slate-500">{worship.category || (isAr ? 'عادة' : 'Habit')}</td><td className="px-4 py-4 text-slate-500">{worship.target} {worship.unit}</td><td className="px-4 py-4 font-black text-slate-800 dark:text-white">{worship.value}/{worship.target}</td><td className="px-4 py-4"><span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${worship.value >= worship.target ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'}`}>{worship.value >= worship.target ? (isAr ? 'مكتملة' : 'Completed') : (isAr ? 'قيد التنفيذ' : 'In progress')}</span></td><td className="px-4 py-4 text-center"><button type="button" onClick={() => document.getElementById('custom-worship-details')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="h-10 rounded-xl border border-violet-200 px-3 text-xs font-bold text-violet-700 dark:border-violet-500/30 dark:text-violet-300">{isAr ? 'تعديل' : 'Edit'}</button></td></tr>)}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#26334a] dark:bg-[#111a2a]">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-black text-slate-900 dark:text-white">{isAr ? 'نشاط العبادة خلال 30 يوماً' : 'Worship activity over 30 days'}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{isAr ? 'اللون الأعمق يعني التزاماً أكبر في ذلك اليوم' : 'Darker cells mean more completed worship that day'}</p></div><Calendar size={19} className="text-violet-500" /></div>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(24px,1fr))]">{worshipHeatmap.map((day) => <span key={day.key} title={`${day.date.toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}`} className={`aspect-square min-h-6 rounded-md border border-white/70 transition hover:scale-110 hover:ring-2 hover:ring-violet-400 dark:border-[#0d1422] ${day.score === 0 ? 'bg-slate-100 dark:bg-slate-700' : day.score === 1 ? 'bg-emerald-100 dark:bg-emerald-950' : day.score === 2 ? 'bg-emerald-300 dark:bg-emerald-800' : day.score === 3 ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-emerald-700 dark:bg-emerald-400'}`} />)}</div>
          </section>

          {/* ── All Prayers Completed Banner ── */}
          <AnimatePresence>
            {allPrayedToday && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-gradient-to-l from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700 rounded-2xl p-5 text-white text-center shadow-lg shadow-green-500/20">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Star size={32} className="mx-auto mb-2" />
                  </motion.div>
                  <p className="text-lg font-bold">{t('prayers.allPrayersCompleted')}</p>
                  <p className="text-sm opacity-80 mt-1">{isAr ? 'جزاك الله خيراً ❤️' : 'May Allah reward you ❤️'}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Five Daily Prayers (with Status Selection) ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="hidden bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {t('prayers.dailyPrayers')}
              </h2>
              <span
                className={`text-xs px-3 py-1 rounded-full font-bold tabular-nums ${
                  allPrayedToday
                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                    : currentPrayedCount > 0
                    ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {currentPrayedCount}/5
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full mb-4 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(currentPrayedCount / 5) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  allPrayedToday
                    ? 'bg-gradient-to-l from-green-400 to-emerald-500'
                    : currentPrayedCount > 0
                    ? 'bg-gradient-to-l from-yellow-400 to-amber-500'
                    : 'bg-gray-300 dark:bg-slate-600'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MAIN_PRAYERS.map((prayer, i) => {
                const currentStatus = currentLog
                  ? getPrayerStatus(currentLog, prayer.key)
                  : null;
                const isSaving = savingStatus === prayer.key;
                return (
                  <div key={prayer.key} className={isSaving ? 'pointer-events-none opacity-60' : ''}>
                    <PrayerStatusSelector
                      label={t(prayer.tKey)}
                      emoji={prayer.icon}
                      currentStatus={currentStatus}
                      onStatusChange={(status) => handleStatusChange(prayer.key, status)}
                      delay={i * 0.05}
                      disabled={isSaving}
                    />
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* ── Sunnah Rawatib ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="hidden bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {t('prayers.sunnah')}
              </h2>
              <span className="text-xs flex items-center gap-1 text-yellow-500 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/40 px-2.5 py-1 rounded-full font-medium">
                <Star size={11} />
                {t('prayers.sunnah')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {SUNNAH_PRAYERS.map((sunnah, i) => {
                const isPrayed = currentLog ? currentLog[sunnah.key] : false;
                const isToggling = togglingField === sunnah.key;
                return (
                  <div key={sunnah.key} className={isToggling ? 'pointer-events-none opacity-60' : ''}>
                    <PrayerToggle
                      label={t(sunnah.tKey)}
                      prayed={isPrayed}
                      onToggle={() => handleToggle(sunnah.key as PrayerField)}
                      delay={i * 0.05}
                    />
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* ── Quran Recitation ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            id="quran-details"
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
                <BookOpen size={20} className="text-blue-500 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {t('prayers.quran')}
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('prayers.quranPages')}
                </label>
                <input
                  type="number"
                  min={0}
                  max={604}
                  value={quranPages}
                  onChange={(e) => setQuranPages(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-sm focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 tabular-nums"
                  placeholder="0"
                />
              </div>

              {/* ── Surah Selector ── */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {isAr ? 'السور المقروءة' : 'Surahs Read'}
                </label>
                <SurahSelector
                  selectedSurahs={localSelectedSurahs}
                  onAdd={handleAddSurah}
                  onRemove={handleRemoveSurah}
                  lang={lang}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('prayers.quranNotes')}
                </label>
                <textarea
                  value={quranNotes}
                  onChange={(e) => setQuranNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-sm focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 resize-none bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  placeholder={t('prayers.quranNotesPlaceholder')}
                />
              </div>
              <button
                onClick={handleSaveQuran}
                disabled={savingQuran}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-800 dark:bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-slate-700 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <AnimatePresence mode="wait">
                  {savingQuran ? (
                    <motion.div
                      key="saving"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    />
                  ) : (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <Save size={16} />
                      {t('prayers.save')}
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </motion.div>

          {/* ── Custom Worship Section ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            id="custom-worship-details"
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center">
                <Heart size={20} className="text-purple-500 dark:text-purple-400" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {isAr ? 'عبادات إضافية' : 'Custom Worship'}
              </h2>
            </div>
            <CustomWorshipSection
              worships={localWorships}
              onSave={handleSaveWorships}
              lang={lang}
            />
          </motion.div>

          {/* ── Statistics ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3">
              {t('prayers.stats')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard
                icon={Flame}
                label={t('prayers.streak')}
                value={stats.streak}
                accent="bg-orange-500"
              />
              <StatCard
                icon={Calendar}
                label={t('prayers.totalDays')}
                value={stats.totalDays}
                accent="bg-slate-600 dark:bg-slate-500"
              />
              <StatCard
                icon={Clock}
                label={t('prayers.completedPrayers').split(' ').slice(0, 2).join(' ')}
                value={stats.totalPrayers}
                accent="bg-emerald-500"
              />
              <StatCard
                icon={Star}
                label={t('prayers.completedSunnah').split(' ').slice(0, 2).join(' ')}
                value={stats.totalSunnah}
                accent="bg-yellow-500"
              />
              <StatCard
                icon={BookOpen}
                label={t('prayers.totalQuranPages').split(' ').slice(0, 2).join(' ')}
                value={stats.totalQuranPages}
                accent="bg-blue-500"
              />
              <StatCard
                icon={TrendingUp}
                label={t('prayers.completionRate').split(' ').slice(0, 2).join(' ')}
                value={`${stats.completionRate}%`}
                accent="bg-purple-500"
              />
            </div>
          </motion.div>

          {/* ── Worship Analytics ── */}
          {prayerLogs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                  <BarChart3 size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('prayers.analytics')}</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {filteredLogs.length} {isAr ? 'سجل' : 'logs'}
                  </p>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="mb-5">
                <FilterBar
                  filterType={filterType}
                  setFilterType={setFilterType}
                  selectedMonth={selectedMonth}
                  setSelectedMonth={setSelectedMonth}
                  selectedYear={selectedYear}
                  setSelectedYear={setSelectedYear}
                  lang={lang}
                />
              </div>

              <UnifiedWorshipChart prayerLogs={filteredLogs} t={t} lang={lang} view={chartView} onViewChange={setChartView} />
            </motion.div>
          )}

          {/* ── History ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5"
          >
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
              {t('prayers.history')}
            </h2>

            {history.length === 0 ? (
              <div className="text-center py-10">
                <Calendar size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
                  {t('prayers.noHistory')}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {t('prayers.noHistoryHint')}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {history.map((log) => (
                  <HistoryRow
                    key={log.log_date}
                    log={log}
                    t={t}
                    onClick={() => {
                      const parts = log.log_date.split('-');
                      setSelectedDate(
                        new Date(
                          parseInt(parts[0], 10),
                          parseInt(parts[1], 10) - 1,
                          parseInt(parts[2], 10)
                        )
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
