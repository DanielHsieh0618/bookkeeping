import type { Metadata, Viewport } from "next";
import { Inter as FontSans } from "next/font/google";
import "../styles/globals.css";

import { cn } from "@/lib/utils";

import ClientLayout from "./client-layout";

import { ThemeProvider } from "@/components/theme-provider";
import { DarkModeToggle } from "@/components/dark-mode-toggle";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Bookkeeping",
  description: "A simple bookkeeping app",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "auto",
};

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/configs/auth";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  console.log("session", session);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("custom-min-h-dvh bg-background font-sans", fontSans.variable)}>
        <ClientLayout session={session}>{children}</ClientLayout>
      </body>
    </html>
  );
}
