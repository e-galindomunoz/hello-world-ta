import type { CSSProperties } from "react";

export type IconName = "grid" | "user" | "sun" | "moon" | "logout" | "menu" | "arrow" | "upload" | "lock" | "spark" | "coffee" | "check" | "settings";
const paths: Record<IconName, React.ReactNode> = {
  settings: <><path d="m9 3-.6 2.4-2 .9-2.2-.7-2 3.5 1.6 1.8v2.2l-1.6 1.8 2 3.5 2.2-.7 2 .9L9 21h4l.6-2.4 2-.9 2.2.7 2-3.5-1.6-1.8v-2.2l1.6-1.8-2-3.5-2.2.7-2-.9L13 3Z" /><circle cx="11" cy="12" r="3" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
  moon: <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" />,
  logout: <><path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h13" /></>,
  menu: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" /></>,
  spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />,
  coffee: <><path d="M4 9h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Zm13 1h2a3 3 0 0 1 0 6h-2M7 3v2m4-2v2m4-2v2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
};
export function Icon({ name, style }: { name: IconName; style?: CSSProperties }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>;
}
export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M8 18c1.5 8 14.5 8 16 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><path d="M10 10v3m12-3v3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg></span>;
}
