export function isValidSupabasePublicKey(key: string): boolean {
  const normalizedKey = key.trim();
  return normalizedKey.startsWith('sb_publishable_') || normalizedKey.startsWith('eyJ');
}

export function isSupabaseConfigured(url: string, key: string): boolean {
  const normalizedUrl = url.trim();
  return Boolean(
    normalizedUrl &&
    !normalizedUrl.includes('placeholder') &&
    !key.includes('placeholder') &&
    isValidSupabasePublicKey(key)
  );
}
