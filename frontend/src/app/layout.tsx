import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReplyBridge | AI Email Auto-Reply Agent & First Responder",
  description: "Securely and automatically analyze, classify, and acknowledge incoming customer emails while keeping sensitive records safe in human hands.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full font-sans antialiased text-slate-900 bg-slate-50 dark:text-slate-100 dark:bg-slate-950 flex flex-col`}
      >
        {children}
      </body>
    </html>
  );
}
