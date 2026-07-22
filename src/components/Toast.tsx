'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useShallow } from '@/lib/useAppShallow';

export default function Toast() {
  const { toasts, removeToast } = useAppStore(useShallow((state) => ({
    toasts: state.toasts,
    removeToast: state.removeToast,
  })));

  const icons = {
    success: <CheckCircle size={18} className="text-emerald-500" />,
    error: <XCircle size={18} className="text-red-500" />,
    info: <Info size={18} className="text-blue-500" />,
  };

  const borders = {
    success: 'border-emerald-200 dark:border-emerald-800',
    error: 'border-red-200 dark:border-red-800',
    info: 'border-blue-200 dark:border-blue-800',
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col-reverse gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border ${borders[toast.type]} shadow-lg max-w-sm`}
          >
            {icons[toast.type]}
            <span className="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{toast.message}</span>
            {toast.onAction && toast.actionLabel && <button type="button" onClick={() => { toast.onAction?.(); removeToast(toast.id); }} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black text-violet-700 transition hover:bg-violet-100 focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-slate-700 dark:text-violet-200">{toast.actionLabel}</button>}
            <button type="button" onClick={() => removeToast(toast.id)} aria-label="Close" className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white">×</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
