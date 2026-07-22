import type { CapacitorConfig } from '@capacitor/cli';

/** GitHub auto-deploys here — keep in sync with src/lib/app-url.ts */
const LIVE_APP_URL = 'https://huzaifahp1989-audio.vercel.app';

const serverUrl = process.env.CAPACITOR_SERVER_URL || LIVE_APP_URL;

const config: CapacitorConfig = {
  appId: 'com.wnapp.id1761553570260',
  appName: 'Kids Zone',
  webDir: 'www',
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith('http://'),
        },
      }
    : {}),
};

export default config;
