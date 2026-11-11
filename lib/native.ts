"use client";

import { useEffect } from "react";

/**
 * Small helpers for when the site runs inside the Android app (Capacitor).
 * In a normal browser every function here does nothing.
 */

type CapacitorGlobal = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  Plugins?: Record<string, unknown>;
};

type SystemBarsPlugin = {
  setStyle: (options: { style: "DARK" | "LIGHT" | "DEFAULT" }) => Promise<void>;
};

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNativeApp(): boolean {
  try {
    return capacitor()?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

export function isNativeAndroid(): boolean {
  try {
    return isNativeApp() && capacitor()?.getPlatform?.() === "android";
  } catch {
    return false;
  }
}

// What the page wants the status bar to look like
let themeDark = false; // follows the light/dark theme
let override: boolean | null = null; // a full screen view can force it

function apply() {
  try {
    const cap = capacitor();
    if (!cap || !isNativeApp()) return;
    if (cap.isPluginAvailable && !cap.isPluginAvailable("SystemBars")) return;

    const plugin = cap.Plugins?.SystemBars as SystemBarsPlugin | undefined;
    if (!plugin?.setStyle) return;

    const dark = override ?? themeDark;
    // DARK = light icons (for a dark page), LIGHT = dark icons (for a light page)
    void plugin.setStyle({ style: dark ? "DARK" : "LIGHT" }).catch(() => {});
  } catch {
    // never let a status bar problem break the page
  }
}

/** The site theme changed (light or dark). */
export function setThemeIsDark(dark: boolean) {
  themeDark = dark;
  apply();
}

/**
 * A screen with its own background (chat theme, reels, stories) says whether it
 * is dark so the clock and battery icons stay readable. Pass null to go back to
 * following the site theme.
 */
export function setStatusBarOverride(dark: boolean | null) {
  override = dark;
  apply();
}

/** Hook form of setStatusBarOverride: set while the screen is mounted. */
export function useStatusBarDark(dark: boolean | null) {
  useEffect(() => {
    setStatusBarOverride(dark);
    return () => setStatusBarOverride(null);
  }, [dark]);
}
