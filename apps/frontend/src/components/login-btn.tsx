"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function LoginBtn() {
  const { data: session } = useSession();
  if (session && session.user && session.user.image) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Image src={session.user.image} alt="account image" width={36} height={36} className="rounded" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{session.user.name}</DropdownMenuLabel>
            <DropdownMenuLabel className="font-light">{session.user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }
  return (
    <>
      {/* (Not signed in) <br /> */}
      <button onClick={() => signIn()}>Sign in</button>
    </>
  );
}
