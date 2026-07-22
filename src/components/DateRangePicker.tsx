'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { parseLocalDate, toLocalDateKey } from '@/lib/localDate';

type DateRange = { start: string | null; end: string | null };
type PresetKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';

interface DateRangePickerProps {
  value: DateRange;
  onApply: (range: DateRange) => void;
  language?: string;
}

const copy = {
  ar: {
    allTime: 'كل الوقت', today: 'اليوم', yesterday: 'أمس', last7: 'آخر 7 أيام',
    last30: 'آخر 30 يومًا', thisMonth: 'هذا الشهر', lastMonth: 'الشهر الماضي',
    custom: 'تخصيص المدى', from: 'من تاريخ', to: 'إلى تاريخ', apply: 'تطبيق', cancel: 'إلغاء',
    selectRange: 'اختر نطاق التاريخ', clear: 'مسح نطاق التاريخ', weekdays: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'],
  },
  en: {
    allTime: 'All time', today: 'Today', yesterday: 'Yesterday', last7: 'Last 7 Days',
    last30: 'Last 30 Days', thisMonth: 'This Month', lastMonth: 'Last Month',
    custom: 'Custom Range', from: 'From date', to: 'To date', apply: 'Apply', cancel: 'Cancel',
    selectRange: 'Select date range', clear: 'Clear date range', weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  },
} as const;

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function presetRange(key: Exclude<PresetKey, 'custom'>): DateRange {
  const today = new Date();
  if (key === 'today') return { start: toLocalDateKey(today), end: toLocalDateKey(today) };
  if (key === 'yesterday') {
    const yesterday = addDays(today, -1);
    return { start: toLocalDateKey(yesterday), end: toLocalDateKey(yesterday) };
  }
  if (key === 'last7') return { start: toLocalDateKey(addDays(today, -6)), end: toLocalDateKey(today) };
  if (key === 'last30') return { start: toLocalDateKey(addDays(today, -29)), end: toLocalDateKey(today) };
  if (key === 'thisMonth') return { start: toLocalDateKey(startOfMonth(today)), end: toLocalDateKey(today) };
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return { start: toLocalDateKey(previousMonth), end: toLocalDateKey(endOfMonth(previousMonth)) };
}

function sameRange(left: DateRange, right: DateRange) {
  return left.start === right.start && left.end === right.end;
}

function CalendarMonth({
  month, range, onSelect, language, label, onPrevious, onNext,
}: {
  month: Date;
  range: DateRange;
  onSelect: (date: Date) => void;
  language: 'ar' | 'en';
  label: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const c = copy[language];
  const locale = language === 'ar' ? 'ar-EG' : 'en-US';
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = addDays(firstDay, -firstDay.getDay());
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const start = range.start ? parseLocalDate(range.start) : null;
  const end = range.end ? parseLocalDate(range.end) : start;

  return (
    <section className="min-w-0 flex-1 px-3 py-3.5 sm:px-4" aria-label={label}>
      <p className="mb-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={onPrevious} aria-label={language === 'ar' ? 'الشهر السابق' : 'Previous month'} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-500/10 dark:hover:text-violet-300">
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
          {month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" onClick={onNext} aria-label={language === 'ar' ? 'الشهر التالي' : 'Next month'} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-500/10 dark:hover:text-violet-300">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center" dir="ltr">
        {c.weekdays.map((day, index) => <span key={`${day}-${index}`} className="py-1 text-[10px] font-semibold text-slate-400">{day}</span>)}
        {days.map((date) => {
          const key = toLocalDateKey(date);
          const outside = date.getMonth() !== month.getMonth();
          const selectedStart = key === range.start;
          const selectedEnd = key === range.end;
          const inRange = Boolean(start && end && date >= start && date <= end);
          const today = key === toLocalDateKey();
          return (
            <button
              type="button"
              key={key}
              onClick={() => onSelect(date)}
              aria-pressed={selectedStart || selectedEnd}
              className={`relative mx-auto my-0.5 grid h-7 w-full max-w-8 place-items-center text-[11px] transition-all ${
                selectedStart || selectedEnd
                  ? 'z-10 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 font-bold text-white shadow-[0_5px_14px_rgba(109,40,217,0.30)]'
                  : inRange
                    ? 'bg-violet-50 font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'
                    : outside
                      ? 'rounded-lg text-slate-300 hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-slate-700/60'
                      : 'rounded-lg text-slate-700 hover:bg-violet-50 hover:text-violet-700 dark:text-slate-200 dark:hover:bg-violet-500/10 dark:hover:text-violet-200'
              } ${today && !selectedStart && !selectedEnd ? 'ring-1 ring-inset ring-violet-300 dark:ring-violet-600' : ''}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function DateRangePicker({ value, onApply, language = 'ar' }: DateRangePickerProps) {
  const lang = language === 'en' ? 'en' : 'ar';
  const c = copy[lang];
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(value.start ? parseLocalDate(value.start) : new Date()));
  const [activePreset, setActivePreset] = useState<PresetKey>('custom');

  const presets = useMemo(() => (
    (['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth'] as const).map((key) => ({ key, range: presetRange(key) }))
  ), []);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const openPicker = () => {
    setDraft(value);
    setVisibleMonth(startOfMonth(value.start ? parseLocalDate(value.start) : new Date()));
    setActivePreset(presets.find((preset) => sameRange(preset.range, value))?.key ?? 'custom');
    setOpen(true);
  };

  const choosePreset = (key: PresetKey) => {
    setActivePreset(key);
    if (key === 'custom') {
      setDraft({ start: null, end: null });
      return;
    }
    const next = presetRange(key);
    setDraft(next);
    setVisibleMonth(startOfMonth(parseLocalDate(next.start!)));
  };

  const selectDate = (date: Date) => {
    const key = toLocalDateKey(date);
    setActivePreset('custom');
    if (!draft.start || draft.end) {
      setDraft({ start: key, end: null });
    } else if (key < draft.start) {
      setDraft({ start: key, end: draft.start });
    } else {
      setDraft({ start: draft.start, end: key });
    }
  };

  const formatDate = (valueToFormat: string) => parseLocalDate(valueToFormat).toLocaleDateString(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const triggerLabel = value.start
    ? `${formatDate(value.start)}${value.end && value.end !== value.start ? ` – ${formatDate(value.end)}` : ''}`
    : c.allTime;
  const secondMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);

  return (
    <div ref={containerRef} className="relative z-30">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => open ? setOpen(false) : openPicker()}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`flex min-w-[190px] items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-all hover:border-violet-300 hover:shadow-md dark:bg-slate-700 dark:text-slate-100 ${open ? 'border-violet-400 ring-4 ring-violet-500/10 dark:border-violet-500' : 'border-slate-200 dark:border-slate-600'}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays size={15} className="shrink-0 text-violet-600 dark:text-violet-300" />
            <span className="truncate" dir="ltr">{triggerLabel}</span>
          </span>
          <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
        {value.start && (
          <button type="button" onClick={() => onApply({ start: null, end: null })} aria-label={c.clear} title={c.clear} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:hover:text-violet-300">
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={c.selectRange}
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.985 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`fixed top-1/2 z-50 w-[calc(100vw-24px)] max-w-[640px] max-h-[calc(100vh-24px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-violet-200/80 bg-white shadow-[0_24px_70px_rgba(76,29,149,0.18)] dark:border-violet-500/25 dark:bg-slate-800 sm:overflow-visible md:w-[calc(100vw-18rem)] ${lang === 'ar' ? 'left-1/2 md:left-[calc((100vw-16rem)/2)]' : 'left-1/2 md:left-[calc((100vw+16rem)/2)]'}`}
          >
            <div className="flex flex-col sm:flex-row" dir="ltr">
              <aside dir={lang === 'ar' ? 'rtl' : 'ltr'} className="order-2 grid grid-cols-2 gap-1 border-t border-slate-100 p-2.5 dark:border-slate-700 sm:order-1 sm:w-36 sm:grid-cols-1 sm:border-e sm:border-t-0 sm:p-3">
                {[...presets.map(({ key }) => key), 'custom' as const].map((key) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => choosePreset(key)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-start text-[11px] font-medium transition-all ${activePreset === key ? 'bg-violet-50 text-violet-700 shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_5px_15px_rgba(139,92,246,0.10)] dark:bg-violet-500/15 dark:text-violet-200' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'}`}
                  >
                    <span>{c[key]}</span>
                    <CalendarDays size={12} className={activePreset === key ? 'text-violet-500' : 'text-slate-400'} />
                  </button>
                ))}
              </aside>

              <div dir="ltr" className="order-1 min-w-0 flex-1 sm:order-2">
                <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-700 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:rtl:divide-x-reverse">
                  {lang === 'ar' ? (
                    <>
                      <CalendarMonth month={secondMonth} range={draft} onSelect={selectDate} language={lang} label={c.to} onPrevious={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} onNext={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} />
                      <CalendarMonth month={visibleMonth} range={draft} onSelect={selectDate} language={lang} label={c.from} onPrevious={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} onNext={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} />
                    </>
                  ) : (
                    <>
                      <CalendarMonth month={visibleMonth} range={draft} onSelect={selectDate} language={lang} label={c.from} onPrevious={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} onNext={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} />
                      <CalendarMonth month={secondMonth} range={draft} onSelect={selectDate} language={lang} label={c.to} onPrevious={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} onNext={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} />
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-700">
                  <button type="button" disabled={!draft.start} onClick={() => { onApply({ start: draft.start, end: draft.end ?? draft.start }); setOpen(false); }} className="flex-1 rounded-lg bg-gradient-to-r from-violet-700 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-[0_6px_18px_rgba(109,40,217,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(109,40,217,0.32)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0">
                    {c.apply}
                  </button>
                  <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50/60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                    {c.cancel}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
