import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@/styles/admin.css";
import "@/styles/admin/admin.css";

export const metadata: Metadata = {
  title: { default: "Admin - Mess Menu", template: "%s - Mess Menu Admin" },
  robots: { index: false, follow: false, nocache: true },
  icons: { icon: [{ url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" }] },
};

export const viewport: Viewport = { themeColor: "#f6f7f2", width: "device-width", initialScale: 1 };

/**
 * Separate root layout: the admin never loads Bootstrap, the student-side
 * stylesheets, analytics, or any third-party script.
 */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  await headers(); // dynamic rendering, required for the CSP nonce
  return (
    <html lang="en">
      <body className="adm">{children}</body>
    </html>
  );
}
