const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

function isNativeCapacitorRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
}

/**
 * Resolves backend routes without silently sending a production APK request to
 * its local WebView origin. Development keeps the existing same-origin Vite
 * proxy behavior; native production requires the deployed API origin.
 */
export function apiUrl(path: string): string {
  if (configuredApiBaseUrl) return `${configuredApiBaseUrl}${path}`;
  if (import.meta.env.DEV || !isNativeCapacitorRuntime()) return path;
  throw new Error('API_BASE_URL_NOT_CONFIGURED');
}

export const apiBaseUrl = configuredApiBaseUrl;
