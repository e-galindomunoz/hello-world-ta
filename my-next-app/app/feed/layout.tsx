import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BrandMark } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { getUser } from "@/lib/supabase/server";
import styles from "./feed.module.css";

export default async function FeedLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const content = <>
    <div className={styles.heading}>
      <span className="eyebrow">The feed</span>
      <h1>The internet needed this<span className="brand-dot">.</span></h1>
      <p>Little moments. Questionable captions. Your call.</p>
    </div>
    {children}
  </>;

  if (user) return <AppShell><div className={styles.main}>{content}</div></AppShell>;

  return <div className={styles.shell}>
    <a className="skip-link" href="#feed-content">Skip to feed</a>
    <header className={styles.header}>
      <Link href="/" className="wordmark"><BrandMark /><span>LetsBeGoofy<span className="brand-dot">.</span></span></Link>
      <nav className={styles.navigation} aria-label="Feed navigation">
        <Link className="button secondary" href="/dashboard">Create</Link>
        <ThemeToggle />
      </nav>
    </header>
    <main id="feed-content" className={styles.main}>
      {content}
    </main>
  </div>;
}
