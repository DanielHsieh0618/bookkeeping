"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import LoginBtn from "@/components/login-btn";
import Link from "next/link";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";

import Image from "next/image";
import { SessionProvider } from "next-auth/react";

export default function ClientLayout({ children, session }: { children: React.ReactNode; session: any }) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <NavigationMenu className="p-3 flex justify-between">
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link href="/" legacyBehavior passHref>
                <NavigationMenuLink className="flex items-center text-xl">
                  <Image src="/piggy-bank.svg" alt="piggy-bookkeeping-icon" width={32} height={32} className="mr-1" />
                  豬豬記帳
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
          <div className="flex items-center gap-2">
            <DarkModeToggle></DarkModeToggle>
            <LoginBtn></LoginBtn>
          </div>
        </NavigationMenu>
        <main className="custom-min-h-dvh px-3 pb-3 flex gap-3 flex-col sm:flex-col items-stretch">{children}</main>
      </ThemeProvider>
    </SessionProvider>
  );
}
