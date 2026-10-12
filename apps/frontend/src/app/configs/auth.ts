import type { NextAuthOptions } from "next-auth"
import { Account, Profile } from "next-auth"
import jwt from "jsonwebtoken";

import GoogleProvider from "next-auth/providers/google"

type SessionProps = {
  session: any;
  token: any;
};

export const authOptions: NextAuthOptions = {
  providers:[
    GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
    }),
  ],
  callbacks: {
    async signIn({account, profile}:{account: Account | null; profile?: Profile | undefined;}) {
        const isAccount = account && profile
        if (isAccount && account.provider === "google") {
            return true
          }
        return true
    },
    session: async ({ session, token }: SessionProps) => {
      if (session?.user) {
        session.user.id = token.sub;
        session.apiToken = jwt.sign(
          { sub: token.sub },
          process.env.BACKEND_JWT_SECRET as string,
          { expiresIn: "15m" }
        );
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "default-secret",
  events: {
    async signIn(message) {
      if (message.account?.provider === "google") {
        const { user } = message;
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/internal/users/bootstrap`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": process.env.INTERNAL_API_SECRET as string,
          },
          body: JSON.stringify({
            googleId: user.id,
            email: user.email,
            userName: user.name,
          }),
        });
      }
    },
  },
}
