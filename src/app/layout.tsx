import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MediBill Pro - Hospital Billing & Patient Workflow System",
  description: "Comprehensive hospital management system with GST-compliant billing, appointment scheduling, and Razorpay payment integration for Indian clinics and hospitals.",
  keywords: ["hospital", "billing", "GST", "Razorpay", "patient management", "appointments", "medical"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <div aria-live="polite" aria-atomic="true" className="sr-only" id="a11y-announcer" />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
