"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";
import { BrandMark, Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsPanel = useRef<HTMLDivElement>(null);
  const settingsTrigger = useRef<HTMLButtonElement | null>(null);
  const sidebar = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!settingsOpen) return;
    const panel = settingsPanel.current;
    const rail = sidebar.current;
    if (!panel || !rail) return;
    function positionSettings() {
      if (!panel || !rail) return;
      const mobile = window.matchMedia("(max-width: 760px)").matches;
      const trigger = document.getElementById(mobile ? "mobile-settings-trigger" : "desktop-settings-trigger");
      const rect = (trigger ?? settingsTrigger.current)?.getBoundingClientRect();
      if (!rect) return;
      const left = mobile ? rect.right - panel.offsetWidth : rail.getBoundingClientRect().right + 12;
      const top = mobile ? rect.top - panel.offsetHeight - 12 : rect.bottom - panel.offsetHeight;
      panel.style.left = `${Math.max(12, Math.min(left, window.innerWidth - panel.offsetWidth - 12))}px`;
      panel.style.top = `${Math.max(12, Math.min(top, window.innerHeight - panel.offsetHeight - 12))}px`;
    }
    positionSettings();
    const observer = new ResizeObserver(positionSettings);
    observer.observe(rail);
    observer.observe(panel);
    window.addEventListener("resize", positionSettings);
    window.addEventListener("scroll", positionSettings, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", positionSettings);
      window.removeEventListener("scroll", positionSettings, true);
    };
  }, [settingsOpen]);
  const isDashboard = pathname === "/dashboard";
  const isFeed = pathname === "/feed";
  const isProfile = pathname === "/dashboard/profile";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>

      {/* ── Desktop sidebar — expands on CSS :hover / :focus-within ── */}
      <aside ref={sidebar} className="sidebar" data-settings-open={settingsOpen} aria-label="Main sidebar">
        <Link className="sidebar-brand" href="/feed" aria-label="LetsBeGoofy — go to feed">
          <BrandMark />
          <span className="nav-label">LetsBeGoofy<span className="brand-dot">.</span></span>
        </Link>
        <nav id="workspace-nav" aria-label="Main navigation">
          <Link aria-label="Feed" href="/feed" className={`nav-item ${isFeed ? "active" : ""}`}
            aria-current={isFeed ? "page" : undefined}>
            <Icon name="flame" /><span className="nav-label">Feed</span>
          </Link>
          <Link aria-label="Create" href="/dashboard" className={`nav-item ${isDashboard ? "active" : ""}`}
            aria-current={isDashboard ? "page" : undefined}>
            <Icon name="camera" /><span className="nav-label">Create</span>
          </Link>
          <Link aria-label="Profile" href="/dashboard/profile" className={`nav-item ${isProfile ? "active" : ""}`}
            aria-current={isProfile ? "page" : undefined}>
            <Icon name="user" /><span className="nav-label">Profile</span>
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <button
            id="desktop-settings-trigger"
            onClick={(event) => { settingsTrigger.current = event.currentTarget; }}
            className={`icon-button ${settingsOpen ? "settings-active" : ""}`}
            type="button"
            popoverTarget="workspace-settings"
            aria-label="Settings"
            aria-expanded={settingsOpen}
            aria-controls="workspace-settings"
          >
            <Icon name="settings" /><span className="nav-label">Settings</span>
          </button>
        </div>
      </aside>

      {/* ── Settings popover ── */}
      <div
        ref={settingsPanel}
        id="workspace-settings"
        className="settings-panel glass"
        popover="auto"
        role="dialog"
        aria-label="Settings"
        onToggle={(event) => setSettingsOpen(event.currentTarget.matches(":popover-open"))}
      >
        <h2>Settings</h2>
        <div className="settings-appearance">
          <span>Appearance</span>
          <ThemeToggle />
        </div>
        <form action={signOut}>
          <button className="settings-logout" type="submit">
            <Icon name="logout" /> Log out
          </button>
        </form>
      </div>

      {/* ── Workspace ── */}
      <div className="workspace">
        <header className="mobile-brand"><Link href="/feed" className="wordmark"><BrandMark /><span>LetsBeGoofy</span></Link></header>
        <main id="main-content" className="workspace-main">{children}</main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="bottom-nav" aria-label="Main navigation">
        <Link href="/feed" className={`bottom-nav-item ${isFeed ? "active" : ""}`}
          aria-current={isFeed ? "page" : undefined}>
          <Icon name="flame" />
          <span>Feed</span>
        </Link>
        <Link href="/dashboard" className={`bottom-nav-item ${isDashboard ? "active" : ""}`}
          aria-current={isDashboard ? "page" : undefined}>
          <Icon name="camera" />
          <span>Create</span>
        </Link>
        <Link href="/dashboard/profile" className={`bottom-nav-item ${isProfile ? "active" : ""}`}
          aria-current={isProfile ? "page" : undefined}>
          <Icon name="user" />
          <span>Profile</span>
        </Link>
        <button
          id="mobile-settings-trigger"
          onClick={(event) => { settingsTrigger.current = event.currentTarget; }}
          aria-expanded={settingsOpen}
          aria-controls="workspace-settings"
          className={`bottom-nav-item ${settingsOpen ? "active" : ""}`}
          type="button"
          popoverTarget="workspace-settings"
          aria-label="Settings"
        >
          <Icon name="settings" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
