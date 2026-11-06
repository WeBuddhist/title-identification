"use client";

import { useEffect } from "react";

// Shown in place of Next's bare "Application error: a client-side exception
// has occurred" page. The monks can't open a browser console, so the error
// is sent to the server, where it shows up in the Render logs.
export default function ErrorScreen({ error }) {
  useEffect(() => {
    const report = {
      message: String(error?.message || error).slice(0, 1000),
      stack: String(error?.stack || "").slice(0, 3000),
      digest: error?.digest,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  // A full reload, not reset(): the usual causes (a restart or deploy while
  // the page was open, a lost connection) leave the in-memory page stale.
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6 text-center bg-white text-black">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p>Your submitted work is saved. Reload the page to continue.</p>
      <button
        onClick={() => window.location.reload()}
        className="px-8 py-3 rounded-md font-medium bg-blue-600 text-white text-xl"
      >
        Reload
      </button>
    </div>
  );
}
