"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/auth/actions";
import { BrandMark, Icon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();
  return <div className={`app-shell ${expanded ? "sidebar-expanded" : ""}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar glass" aria-label="Workspace sidebar">
      <Link className="sidebar-brand" href="/" aria-label="LetsBeGoofy home"><BrandMark /><span className="nav-label">LetsBeGoofy<span className="brand-dot">.</span></span></Link>
      <button className="icon-button sidebar-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="workspace-nav" aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"} title={expanded ? "Collapse sidebar" : "Expand sidebar"}><Icon name="menu" /><span className="nav-label">Collapse menu</span></button>
      <nav id="workspace-nav" aria-label="Main navigation">
        <Link href="/dashboard" className={`nav-item ${pathname === "/dashboard" ? "active" : ""}`} aria-current={pathname === "/dashboard" ? "page" : undefined} aria-label="Dashboard" title="Dashboard"><Icon name="grid" /><span className="nav-label">Dashboard</span></Link>
        <Link href="/dashboard/profile" className={`nav-item ${pathname === "/dashboard/profile" ? "active" : ""}`} aria-current={pathname === "/dashboard/profile" ? "page" : undefined} aria-label="Profile" title="Profile"><Icon name="user" /><span className="nav-label">Profile</span></Link>
      </nav>
      <div className="sidebar-bottom"><button className={`icon-button ${settingsOpen ? "settings-active" : ""}`} type="button" popoverTarget="workspace-settings" aria-label="Settings" aria-expanded={settingsOpen} aria-controls="workspace-settings" title="Settings"><Icon name="settings" /><span className="nav-label">Settings</span></button><span className="sidebar-footnote nav-label">A little more you.</span></div>
    </aside>
    <div id="workspace-settings" className="settings-panel glass" popover="auto" role="dialog" aria-label="Settings" onToggle={(event) => setSettingsOpen(event.currentTarget.matches(":popover-open"))}>
      <h2>Settings</h2>
      <div className="settings-appearance"><span>Appearance</span><ThemeToggle /></div>
      <form action={signOut}><button className="settings-logout" type="submit"><Icon name="logout" /> Log out</button></form>
    </div>
    <div className="workspace"><main id="main-content" className="workspace-main">{children}</main><footer className="workspace-footer"><span>LetsBeGoofy<span className="brand-dot">.</span></span><span>Make yourself at home.</span></footer></div>
  </div>;
}
