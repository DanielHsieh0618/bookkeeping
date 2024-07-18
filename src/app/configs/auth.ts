import type { NextAuthOptions } from "next-auth"
import { Account, Profile } from "next-auth"

import {sql} from "@vercel/postgres";

import GoogleProvider from "next-auth/providers/google"
import { v4 as uuidv4 } from 'uuid';

type SessionProps = {
  session: any;
  token: any;
};

export const authOptions: NextAuthOptions = {
  // your configs
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
            // return profile.email_verified && profile.email.endsWith("@example.com")
            return true
          }
        return true // Do different verification for other providers that don't have `email_verified`
    },
    session: async ({ session, token }: SessionProps) => {
      if (session?.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },

  secret: process.env.JWT_SECRET || "default-secret",
  events: {
    async signIn(message) {
      if (message.account?.provider === "google") {
        const { user } = message;
        const google_id = user.id;
        const { rows: users } = await sql`SELECT * FROM users WHERE google_id=${google_id};`;
        if (users.length === 0) {
          await sql`INSERT INTO users (google_id, email, user_name, uuid) VALUES (${google_id}, ${user?.email}, ${user?.name}, ${uuidv4()});`;
          const { rows: users } = await sql`SELECT user_id FROM users WHERE google_id=${google_id};`;
          await sql`INSERT INTO categories (user_id, category_name, category_icon) VALUES (${users[0].user_id}, 'Food', 'apple');`;
        }
      }
    },
  },
}
