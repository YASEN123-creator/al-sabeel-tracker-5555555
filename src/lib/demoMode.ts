export const LOCAL_DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
export const LOCAL_DEMO_MARKER = 'sabeel_local_demo_v1';

export function isLocalDemoRequested(): boolean {
  return typeof window !== 'undefined' && window.location.hostname === 'localhost' &&
    new URLSearchParams(window.location.search).get('demo') === '1';
}
