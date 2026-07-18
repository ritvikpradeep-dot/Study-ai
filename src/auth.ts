import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;
        if (!user.isActive) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      const userId = token.userId as string | undefined;
      if (!userId) return token;

      // Re-check role/active status from the DB on every request so admin
      // promotions and deactivations take effect without forcing a re-login.
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, isActive: true, interfacePreference: true },
      });
      if (!dbUser || !dbUser.isActive) {
        token.userId = undefined;
        token.role = undefined;
        token.interfacePreference = undefined;
        return token;
      }
      token.role = dbUser.role;
      token.interfacePreference = dbUser.interfacePreference ?? undefined;
      return token;
    },
    async session({ session, token }) {
      const userId = token.userId as string | undefined;
      if (!userId) {
        // Deactivated (or deleted) user: strip user off the session so
        // `session?.user` checks throughout the app treat this as signed out.
        return { ...session, user: undefined } as unknown as typeof session;
      }
      if (session.user) {
        session.user.id = userId;
        session.user.role = (token.role as "USER" | "ADMIN" | undefined) ?? "USER";
        session.user.interfacePreference =
          (token.interfacePreference as "MOBILE" | "DESKTOP" | undefined) ?? null;
      }
      return session;
    },
  },
});

export const isGoogleAuthEnabled = googleEnabled;
