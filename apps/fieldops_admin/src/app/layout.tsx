import type { Metadata } from "next";
import "./globals.css";
import AdminAuthGuard from "@/components/admin-auth-guard";
import AdminSidebar from "@/components/admin-sidebar";

export const metadata: Metadata = {
  title: "FieldOps Admin",
  description: "FieldOps super-admin panel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-stone-50 text-stone-900 antialiased">
        <AdminAuthGuard>
          <div className="flex h-screen">
            <AdminSidebar />
            <main className="flex-1 overflow-y-auto p-8">{children}</main>
          </div>
        </AdminAuthGuard>
      </body>
    </html>
  );
}
