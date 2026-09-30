"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";

function subscribe(callback: () => void) {
  const sync = () => {
    try { document.documentElement.dataset.theme = localStorage.getItem("letsbegoofy-theme") === "light" ? "light" : "dark"; } catch {}
    callback();
  };
  window.addEventListener("storage", sync);
  window.addEventListener("theme-change", callback);
  return () => { window.removeEventListener("storage", sync); window.removeEventListener("theme-change", callback); };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme ?? "dark", () => "dark");
  const label = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
  return <button type="button" className="icon-button theme-toggle" aria-label={label} title={label} onClick={() => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("letsbegoofy-theme", next); } catch {}
    window.dispatchEvent(new Event("theme-change"));
  }}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>;
}
