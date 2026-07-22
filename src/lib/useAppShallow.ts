import { useShallow as useZustandShallow } from 'zustand/react/shallow';
import type { AppState } from './store';

/**
 * Keeps Zustand's shallow selector optimization while providing the app store
 * state type that TypeScript cannot infer through the nested generic helper.
 */
export function useShallow<T>(selector: (state: AppState) => T): (state: AppState) => T {
  return useZustandShallow(selector);
}
