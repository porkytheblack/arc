import { initOasis } from 'oasis-sdk';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

const OASIS_API_KEY = import.meta.env.VITE_OASIS_API_KEY ?? '';
const OASIS_SERVER_URL = import.meta.env.VITE_OASIS_SERVER_URL ?? '';
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.1.0';

export const oasis = initOasis({
  apiKey: OASIS_API_KEY,
  serverUrl: OASIS_SERVER_URL,
  appVersion: APP_VERSION,
  enableAutoCrashReporting: true,
  debug: import.meta.env.DEV,
});

export async function checkForUpdates(): Promise<{
  available: boolean;
  version?: string;
}> {
  try {
    const update = await check();
    if (update) {
      return { available: true, version: update.version };
    }
    return { available: false };
  } catch (e) {
    console.error('Update check failed:', e);
    return { available: false };
  }
}

export async function downloadAndInstallUpdate(): Promise<void> {
  const update = await check();
  if (update) {
    await update.downloadAndInstall();
    await relaunch();
  }
}
