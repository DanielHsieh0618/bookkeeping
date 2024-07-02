
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import type { NextAuthOptions } from "next-auth"

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
  ]
}

const handler =  NextAuth(authOptions)
export { handler as GET, handler as POST }

