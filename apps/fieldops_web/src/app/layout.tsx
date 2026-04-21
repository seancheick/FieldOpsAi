import type { Metadata } from "next";
import "./globals.css";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { Providers } from "./providers";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "FieldOps AI — Command Center",
  description:
    "Monitor field operations, worker activity, and proof timelines.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn("font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body
        className="bg-stone-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100"
        suppressHydrationWarning
      >
        {/* Applies stored/system theme before hydration to avoid flash.
            Must be the first child of <body> in App Router — <head> in a layout
            collides with Next.js's metadata system in prod builds. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Providers>
          <AuthGuard>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
              </main>
            </div>
            <CommandPalette />
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
