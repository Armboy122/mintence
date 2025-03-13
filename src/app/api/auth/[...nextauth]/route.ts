import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { compare } from "bcrypt";
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Redis } from "ioredis";
import { Adapter } from "next-auth/adapters";

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL as string);

// ฟังก์ชันสำหรับการเก็บ session ใน Redis
async function setRedisSession(sessionToken: string, session: any, maxAge: number) {
  await redis.set(`session:${sessionToken}`, JSON.stringify(session), 'EX', maxAge);
}

// ฟังก์ชันสำหรับการดึง session จาก Redis
async function getRedisSession(sessionToken: string) {
  const session = await redis.get(`session:${sessionToken}`);
  if (!session) return null;
  return JSON.parse(session);
}

// ฟังก์ชันสำหรับการลบ session จาก Redis
async function deleteRedisSession(sessionToken: string) {
  await redis.del(`session:${sessionToken}`);
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email,
          },
          include: {
            department: true,
          },
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password,
          user.haspassword
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          employeeId: user.employeeId,
          departmentId: user.departmentId,
          departmentName: user.department.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.employeeId = user.employeeId;
        token.departmentId = user.departmentId;
        token.departmentName = user.departmentName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.employeeId = token.employeeId as string;
        session.user.departmentId = token.departmentId as string;
        session.user.departmentName = token.departmentName as string;
        
        // เก็บ session ใน Redis
        await setRedisSession(
          token.jti as string,
          session,
          authOptions.session?.maxAge || 30 * 24 * 60 * 60
        );
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      // ลบ session จาก Redis เมื่อ sign out
      if (token?.jti) {
        await deleteRedisSession(token.jti as string);
      }
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 