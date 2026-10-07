import type { CSSProperties } from "react";

export type IconName =
  | "grid" | "user" | "sun" | "moon" | "logout" | "menu" | "arrow"
  | "upload" | "lock" | "spark" | "coffee" | "check" | "settings"
  | "home" | "camera" | "flame" | "bolt" | "thumbUp" | "thumbDown";

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
  home: <><path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10.5Z" /><path d="M9 22V12h6v10" /></>,
  camera: <><rect x="2" y="7" width="20" height="14" rx="3" /><circle cx="12" cy="14" r="4" /><path d="M16 7v-.5A2.5 2.5 0 0 0 13.5 4h-3A2.5 2.5 0 0 0 8 6.5V7" /></>,
  flame: <path d="M12 22c4.4 0 7-2.8 7-6.5 0-2.5-1.5-4.5-3-5.5 0 2-1 3-2.5 3C15.5 9 14 6 10 4c0 4-3 6.5-3 9.5C7 17.2 8.8 22 12 22Z" />,
  bolt: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />,
  thumbUp: <><path d="M7 22V11" /><path d="M2 12v9a1 1 0 0 0 1 1h4V11L11 2h1a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2l-1 8a2 2 0 0 1-2 2H7" /></>,
  thumbDown: <><path d="M17 2v11" /><path d="M22 12V3a1 1 0 0 0-1-1h-4v11l-4 9h-1a2 2 0 0 1-2-2v-4H5a2 2 0 0 1-2-2l1-8a2 2 0 0 1 2-2h11" /></>,
};

export function Icon({ name, style }: { name: IconName; style?: CSSProperties }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>;
}

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      {/* Supplied vector artwork; keep the mark's geometry intact. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/primary_icon.svg" alt="" width={48} height={48} />
    </span>
  );
}
