import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.danum.app',
  appName: 'Danum',
  webDir: 'out',
  server: {
    url: 'https://danum.vercel.app',
    cleartext: true
  },
  plugins: {
    SystemBars: {
      // Gives the page the status bar / gesture bar sizes as CSS variables
      // (--safe-area-inset-*), which app/globals.css turns into --sat / --sab
      insetsHandling: 'css'
    }
  }
};

export default config;