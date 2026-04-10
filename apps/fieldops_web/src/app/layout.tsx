import type { Metadata } from "next";
import "./globals.css";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { Providers } from "./providers";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

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
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="bg-stone-50 text-slate-900 antialiased" suppressHydrationWarning>
        <Providers>
          <AuthGuard>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
              </main>
            </div>
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
