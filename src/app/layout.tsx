import { Toaster } from "react-hot-toast";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Title Identification Tool",
  description: "Tool by OpenPecha for title identification",
  // Stops Chrome offering translation at all (see translate="no" below).
  other: { google: "notranslate" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // translate="no": the UI is in Tibetan under lang="en", so Chrome offers
    // to translate it. Translation rewrites text nodes React owns, and the
    // next re-render crashes with "a client-side exception has occurred".
    <html lang="en" translate="no">
      <body>
        {children}
        <Toaster position="top-center" reverseOrder={false} />
      </body>
    </html>
  );
}
