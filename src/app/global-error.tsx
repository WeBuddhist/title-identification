"use client";

import "./globals.css";
import ErrorScreen from "@/components/ErrorScreen";

// Catches what error.tsx can't: errors in the root layout or the router
// itself. It replaces the root layout, so it needs its own <html>/<body>.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en" translate="no">
      <body>
        <ErrorScreen error={error} />
      </body>
    </html>
  );
}
