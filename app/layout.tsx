import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import SeedButton from "@/components/SeedButton";
import ApprovalsNavLink from "@/components/ApprovalsNavLink";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "pelta.ai",
  description: "pelta.ai — AI governance platform for prompt guard, tool classification, and compliance dashboards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head />
      <body className="min-h-full flex flex-col">
        <header className="flex items-center gap-6 px-4 h-12 border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-50">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-accent">
              <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
              <path d="M12 7a5 5 0 0 1 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
              <path d="M12 11a1 1 0 0 1 1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
            <span className="text-sm tracking-tight">
              <span className="font-bold text-text-primary">pelta</span>
              <span className="text-accent">.</span>
              <span className="font-light text-text-secondary">ai</span>
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1 text-xs font-medium text-text-secondary">
            <NavLink href="/employee/prompt-guard">Prompt Guard</NavLink>
            <NavLink href="/employee/redress">Redress</NavLink>
            <span className="text-text-muted">/</span>
            <NavLink href="/admin/dashboard">Dashboard</NavLink>
            <NavLink href="/admin/tools/new">Classify</NavLink>
            <NavLink href="/admin/requests">Requests</NavLink>
            <ApprovalsNavLink />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-mono text-text-tertiary tracking-wider uppercase hidden sm:block">
              NIST AI RMF
            </span>
            <SeedButton />
            <ThemeToggle />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-2.5 py-1 rounded hover:bg-surface-hover hover:text-text-primary transition-colors"
    >
      {children}
    </Link>
  );
}
