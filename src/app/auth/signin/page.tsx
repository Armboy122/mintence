import { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | ระบบลงคุมสวัสดิการ",
  description: "เข้าสู่ระบบเพื่อใช้งานระบบลงคุมสวัสดิการ",
};

export default function SignInPage() {
  return (
    <div className="container relative flex min-h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 h-6 w-6"
          >
            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
          </svg>
          ระบบลงคุมสวัสดิการ
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              ระบบลงคุมสวัสดิการช่วยให้การจัดการสวัสดิการของพนักงานเป็นไปอย่างมีประสิทธิภาพ
              สะดวก และรวดเร็ว
            </p>
            <footer className="text-sm">ฝ่ายทรัพยากรบุคคล</footer>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              เข้าสู่ระบบ
            </h1>
            <p className="text-sm text-muted-foreground">
              กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบ
            </p>
          </div>
          <LoginForm />
          <p className="px-8 text-center text-sm text-muted-foreground">
            หากมีปัญหาในการเข้าสู่ระบบ กรุณาติดต่อฝ่ายทรัพยากรบุคคล
          </p>
        </div>
      </div>
    </div>
  );
} 