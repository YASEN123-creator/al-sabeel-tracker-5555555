export type StorageValidator<T> = (value: unknown) => boolean;

export interface SafeParseResult<T> {
  value: T;
  valid: boolean;
}

export function safeParseJsonResult<T>(
  raw: string | null,
  fallback: T,
  validator?: StorageValidator<T>,
): SafeParseResult<T> {
  if (raw === null) return { value: fallback, valid: false };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (validator && !validator(parsed)) return { value: fallback, valid: false };
    return { value: parsed as T, valid: true };
  } catch {
    return { value: fallback, valid: false };
  }
}

export function safeParseJson<T>(
  raw: string | null,
  fallback: T,
  validator?: StorageValidator<T>,
): T {
  return safeParseJsonResult(raw, fallback, validator).value;
}

export function readStorageJson<T>(
  key: string,
  fallback: T,
  validator?: StorageValidator<T>,
): T {
  if (typeof window === 'undefined') return fallback;

  try {
    return safeParseJson(localStorage.getItem(key), fallback, validator);
  } catch {
    return fallback;
  }
}

export function writeStorageJson(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readStorageText(
  key: string,
  fallback: string,
  validator?: (value: string) => boolean,
): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = localStorage.getItem(key);
    if (value === null || (validator && !validator(value))) return fallback;
    return value;
  } catch {
    return fallback;
  }
}

export function writeStorageText(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export const isArrayValue = (value: unknown): value is unknown[] => Array.isArray(value);

export const isRecordValue = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
