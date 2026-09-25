"use client";

import Script from "next/script";
import { useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; ux_mode: "redirect"; login_uri: string; auto_select: boolean }) => void;
          renderButton: (element: HTMLElement, options: { theme: string; size: string; text: string }) => void;
        };
      };
    };
  }
}

export function GoogleSignIn() {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading Google sign-in…");

  function renderButton() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!window.google || !container.current || !clientId) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      ux_mode: "redirect",
      login_uri: `${window.location.origin}/auth/callback`,
      auto_select: false,
    });
    window.google.accounts.id.renderButton(container.current, {
      theme: "outline", size: "large", text: "continue_with",
    });
    setStatus("");
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" onReady={renderButton}
        onError={() => setStatus("Google sign-in could not load. Check your connection and reload this page.")} />
      <div ref={container} />
      <p role="status">{status}</p>
    </>
  );
}
