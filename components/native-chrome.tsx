"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import {
  isNativeAndroid,
  setStatusBarOverride,
  setThemeIsDark,
} from "@/lib/native";

/**
 * Lives once in the root layout. Only does anything inside the Android app:
 *  1. keeps the status bar icons readable in light and dark theme
 *  2. makes sure the page is never pushed under the status bar, even on an
 *     older Android WebView that reports no safe area
 */
export function NativeChrome() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    setThemeIsDark(resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    if (!isNativeAndroid()) return;

    const root = document.documentElement;
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:var(--sat)";
    document.body.appendChild(probe);

    const measure = () => parseFloat(getComputedStyle(probe).paddingTop) || 0;

    // Give Capacitor a moment to inject the real value first
    const timer = window.setTimeout(() => {
      if (measure() === 0) {
        // Typical Android status bar height. Better a slightly roomy header
        // than a back button hidden under the clock.
        root.style.setProperty("--safe-area-inset-top", "28px");
      }
    }, 800);

    return () => {
      window.clearTimeout(timer);
      probe.remove();
      setStatusBarOverride(null);
    };
  }, []);

  return null;
}
