import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google"
import "../styles/globals.css";

import { cn } from "@/lib/utils"
import Link from "next/link"

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList
} from "@/components/ui/navigation-menu"

import Image from "next/image"

import { ThemeProvider } from "@/components/theme-provider"
import { DarkModeToggle } from "@/components/dark-mode-toggle"

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "Bookkeeping",
  description: "A simple bookkeeping app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body 
        className={cn(
          "custom-min-h-dvh bg-background font-sans",
          fontSans.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NavigationMenu className="p-3 flex justify-between" >
            <NavigationMenuList>
              <NavigationMenuItem>
                <Link href="/" legacyBehavior passHref>
                  <NavigationMenuLink className="flex items-center text-xl">
                    <Image src="/piggy-bank.svg" alt="piggy-bookkeeping-icon" width={32} height={32} className="mr-1"/>
                    豬豬記帳
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
            <DarkModeToggle></DarkModeToggle>
          </NavigationMenu>
          <main className="custom-min-h-dvh px-3 pb-3 flex gap-3 flex-col sm:flex-row items-stretch">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
