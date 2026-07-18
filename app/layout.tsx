import type { Metadata } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";
import Sidebar, { SlimTopBar } from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head />
      <body className="min-h-full flex" suppressHydrationWarning>
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <SlimTopBar />
          <main className="flex-1 flex flex-col min-h-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
