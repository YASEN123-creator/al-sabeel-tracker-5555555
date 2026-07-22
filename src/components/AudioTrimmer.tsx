'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Play, Square, Check, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Helpers ──────────────────────────────────────────────────────────────────

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const bits = 16;

  let interleaved: Float32Array;
  if (numCh >= 2) {
    const L = buffer.getChannelData(0);
    const R = buffer.getChannelData(1);
    interleaved = new Float32Array(L.length + R.length);
    for (let i = 0; i < L.length; i++) {
      interleaved[i * 2] = L[i];
      interleaved[i * 2 + 1] = R[i];
    }
  } else {
    interleaved = buffer.getChannelData(0);
  }

  const dataLen = interleaved.length * (bits / 8);
  const wav = new ArrayBuffer(44 + dataLen);
  const v = new DataView(wav);

  const w = (off: number, str: string) => { for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, numCh, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * numCh * (bits / 8), true);
  v.setUint16(32, numCh * (bits / 8), true); v.setUint16(34, bits, true);
  w(36, 'data'); v.setUint32(40, dataLen, true);

  let off = 44;
  for (let i = 0; i < interleaved.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([wav], { type: 'audio/wav' });
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
}

// ── Component ────────────────────────────────────────────────────────────────

interface AudioTrimmerProps {
  audioSrc: string;           // data-URL of the uploaded audio
  onConfirm: (trimmedDataUrl: string) => void;
  onCancel: () => void;
  lang: string;
}

export default function AudioTrimmer({ audioSrc, onConfirm, onCancel, lang }: AudioTrimmerProps) {
  const isAr = lang === 'ar';

  const [waveData, setWaveData] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [startPct, setStartPct] = useState(0);
  const [endPct, setEndPct] = useState(100);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  // ── Load audio + generate waveform ──
  useEffect(() => {
    let cancelled = false;
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    audioCtxRef.current = ctx;

    (async () => {
      try {
        const res = await fetch(audioSrc);
        const arrBuf = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(arrBuf);
        if (cancelled) return;

        bufferRef.current = buf;
        setDuration(buf.duration);

        const raw = buf.getChannelData(0);
        const bars = 120;
        const blockSize = Math.floor(raw.length / bars);
        const data: number[] = [];
        for (let i = 0; i < bars; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[i * blockSize + j]);
          data.push(sum / blockSize);
        }
        const peak = Math.max(...data, 0.0001);
        setWaveData(data.map(v => v / peak));
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ctx.close();
    };
  }, [audioSrc]);

  // ── Mouse / Touch helpers ──
  const getPctFromEvent = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  const handlePointerDown = useCallback((clientX: number) => {
    const pct = getPctFromEvent(clientX);
    const dStart = Math.abs(pct - startPct);
    const dEnd = Math.abs(pct - endPct);
    if (dStart < 6) { setDragging('start'); }
    else if (dEnd < 6) { setDragging('end'); }
    else if (pct < (startPct + endPct) / 2) { setStartPct(Math.min(pct, endPct - 1)); setDragging('start'); }
    else { setEndPct(Math.max(pct, startPct + 1)); setDragging('end'); }
  }, [getPctFromEvent, startPct, endPct]);

  const handlePointerMove = useCallback((clientX: number) => {
    if (!dragging) return;
    const pct = getPctFromEvent(clientX);
    if (dragging === 'start') setStartPct(Math.min(pct, endPct - 1));
    else setEndPct(Math.max(pct, startPct + 1));
  }, [dragging, getPctFromEvent, startPct, endPct]);

  const handlePointerUp = useCallback(() => setDragging(null), []);

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => { e.preventDefault(); handlePointerDown(e.clientX); };
  const onMouseMove = (e: React.MouseEvent) => handlePointerMove(e.clientX);
  const onMouseUp = () => handlePointerUp();

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => { handlePointerDown(e.touches[0].clientX); };
  const onTouchMove = (e: React.TouchEvent) => { e.preventDefault(); handlePointerMove(e.touches[0].clientX); };

  // Global mouse/touch up (so dragging continues outside the element)
  useEffect(() => {
    const onGlobalUp = () => setDragging(null);
    const onGlobalMove = (e: MouseEvent) => {
      if (!dragging) return;
      handlePointerMove(e.clientX);
    };
    const onGlobalTouch = (e: TouchEvent) => {
      if (!dragging) return;
      handlePointerMove(e.touches[0].clientX);
    };
    window.addEventListener('mouseup', onGlobalUp);
    window.addEventListener('mousemove', onGlobalMove);
    window.addEventListener('touchend', onGlobalUp);
    window.addEventListener('touchmove', onGlobalTouch, { passive: false });
    return () => {
      window.removeEventListener('mouseup', onGlobalUp);
      window.removeEventListener('mousemove', onGlobalMove);
      window.removeEventListener('touchend', onGlobalUp);
      window.removeEventListener('touchmove', onGlobalTouch);
    };
  }, [dragging, handlePointerMove]);

  // ── Play / Stop preview ──
  const stopPreview = useCallback(() => {
    if (sourceRef.current) { try { sourceRef.current.stop(); } catch { /* ok */ } sourceRef.current = null; }
    setPlaying(false);
  }, []);

  const playPreview = useCallback(() => {
    if (!bufferRef.current || !audioCtxRef.current) return;
    stopPreview();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const buf = bufferRef.current;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const s = (startPct / 100) * duration;
    const e = (endPct / 100) * duration;
    src.start(0, s, e - s);
    sourceRef.current = src;
    setPlaying(true);
    src.onended = () => setPlaying(false);
  }, [duration, startPct, endPct, stopPreview]);

  useEffect(() => () => stopPreview(), [stopPreview]);

  // ── Trim + encode ──
  const handleConfirm = async () => {
    const buf = bufferRef.current;
    if (!buf) return;
    setProcessing(true);

    try {
      const s0 = Math.floor((startPct / 100) * buf.length);
      const s1 = Math.floor((endPct / 100) * buf.length);
      const len = s1 - s0;

      const ctx = audioCtxRef.current || new AudioContext();
      const trimmed = ctx.createBuffer(buf.numberOfChannels, len, buf.sampleRate);
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        trimmed.copyToChannel(buf.getChannelData(ch).slice(s0, s1), ch);
      }

      const blob = audioBufferToWav(trimmed);
      const url = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      onConfirm(url);
    } catch {
      onCancel();
    } finally {
      setProcessing(false);
    }
  };

  // ── Computed ──
  const startSec = (startPct / 100) * duration;
  const endSec = (endPct / 100) * duration;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 pb-0">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center">
                <Scissors size={18} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                  {isAr ? 'قص الصوت' : 'Trim Audio'}
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {isAr ? 'حدد الجزء اللي عايزه من الصوت' : 'Select the part you want'}
                </p>
              </div>
            </div>
            <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Waveform */}
            {loading ? (
              <div className="h-28 bg-gray-100 dark:bg-slate-700 rounded-xl animate-pulse flex items-center justify-center">
                <span className="text-xs text-gray-400">{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
              </div>
            ) : (
              <>
                {/* Time labels */}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-mono">
                  <span className="bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">{formatTime(startSec)}</span>
                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                    {isAr ? 'المدة المختارة' : 'Selected'}: {formatTime(endSec - startSec)}
                  </span>
                  <span className="bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">{formatTime(endSec)}</span>
                </div>

                {/* Waveform area */}
                <div
                  ref={containerRef}
                  className="relative h-28 bg-gray-50 dark:bg-slate-900 rounded-xl overflow-hidden select-none touch-none"
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onMouseUp}
                  style={{ cursor: dragging ? 'grabbing' : 'crosshair' }}
                >
                  {/* Bars */}
                  <div className="absolute inset-0 flex items-center justify-center px-3 gap-[2px]">
                    {waveData.map((v, i) => {
                      const barCenter = ((i + 0.5) / waveData.length) * 100;
                      const inRange = barCenter >= startPct && barCenter <= endPct;
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-full min-w-[2px] transition-colors duration-75 ${
                            inRange
                              ? 'bg-purple-500 dark:bg-purple-400'
                              : 'bg-gray-300 dark:bg-slate-600 opacity-40'
                          }`}
                          style={{ height: `${Math.max(v * 85, 4)}%` }}
                        />
                      );
                    })}
                  </div>

                  {/* Dim overlay - left */}
                  {startPct > 0 && (
                    <div className="absolute inset-y-0 left-0 bg-slate-900/20 dark:bg-black/40 pointer-events-none" style={{ width: `${startPct}%` }} />
                  )}
                  {/* Dim overlay - right */}
                  {endPct < 100 && (
                    <div className="absolute inset-y-0 right-0 bg-slate-900/20 dark:bg-black/40 pointer-events-none" style={{ width: `${100 - endPct}%` }} />
                  )}

                  {/* Start handle */}
                  <div
                    className="absolute top-0 bottom-0 w-5 -translate-x-1/2 flex flex-col items-center justify-center z-10"
                    style={{ left: `${startPct}%` }}
                  >
                    <div className="w-1 h-6 bg-white dark:bg-slate-200 rounded-full shadow-lg" />
                    <div className="w-3 h-3 bg-purple-600 dark:bg-purple-500 rounded-full border-2 border-white dark:border-slate-200 shadow-md -mt-0.5" />
                    <div className="w-1 h-6 bg-white dark:bg-slate-200 rounded-full shadow-lg -mt-0.5" />
                  </div>

                  {/* End handle */}
                  <div
                    className="absolute top-0 bottom-0 w-5 -translate-x-1/2 flex flex-col items-center justify-center z-10"
                    style={{ left: `${endPct}%` }}
                  >
                    <div className="w-1 h-6 bg-white dark:bg-slate-200 rounded-full shadow-lg" />
                    <div className="w-3 h-3 bg-purple-600 dark:bg-purple-500 rounded-full border-2 border-white dark:border-slate-200 shadow-md -mt-0.5" />
                    <div className="w-1 h-6 bg-white dark:bg-slate-200 rounded-full shadow-lg -mt-0.5" />
                  </div>

                  {/* Selected range background */}
                  <div
                    className="absolute inset-y-0 bg-purple-500/10 dark:bg-purple-400/10 pointer-events-none"
                    style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
                  />
                </div>
              </>
            )}

            {/* Play / Stop */}
            {!loading && (
              <button
                onClick={playing ? stopPreview : playPreview}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-950/60 transition-colors"
              >
                {playing ? <Square size={16} /> : <Play size={16} />}
                {playing
                  ? (isAr ? 'إيقاف' : 'Stop')
                  : (isAr ? 'معاينة الجزء المختار' : 'Preview Selection')
                }
              </button>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleConfirm}
                disabled={processing || loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                <Check size={16} />
                {processing
                  ? (isAr ? 'جاري القص...' : 'Trimming...')
                  : (isAr ? 'تأكيد القص' : 'Confirm Trim')
                }
              </button>
              <button
                onClick={onCancel}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
