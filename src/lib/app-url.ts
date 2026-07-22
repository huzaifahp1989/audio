/** Canonical live app URL (GitHub auto-deploys here). */
export const LIVE_APP_URL = 'https://huzaifahp1989-audio.vercel.app';

/** Public URL used in emails, links, and fallbacks. */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    LIVE_APP_URL
  );
}
