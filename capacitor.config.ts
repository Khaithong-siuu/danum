import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.danum.app',
  appName: 'Danum',
  webDir: 'out',
  server: {
    url: 'https://danum.vercel.app',
    cleartext: true
  }
};

export default config;