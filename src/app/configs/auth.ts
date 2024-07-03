import type { NextAuthOptions } from "next-auth"
import NextAuth, { Account, Profile } from "next-auth"

import GoogleProvider from "next-auth/providers/google"
export const authOptions: NextAuthOptions = {
  // your configs
  providers:[
    GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        authorization: {
          params: {
              prompt: "consent",
              access_type: "offline",
              response_type: "code"
          }
        }
        
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
    }
  },

  secret: process.env.JWT_SECRET || "default-secret"
}
