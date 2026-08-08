import { Toaster } from "react-hot-toast";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Title Identification Tool",
  description: "Tool by OpenPecha for title identification",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-center" reverseOrder={false} />
      </body>
    </html>
  );
}
