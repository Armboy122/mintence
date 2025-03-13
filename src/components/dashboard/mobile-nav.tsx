"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "next-auth";
import { cn } from "@/lib/utils";
import {
  FileText,
  Home,
  ListChecks,
  PlusCircle,
  Settings,
  Users,
  Layers,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MobileNavProps {
  user: User;
  className?: string;
}

export function MobileNav({ user, className }: MobileNavProps) {
  const pathname = usePathname();
  const isAdmin = user.role === "ADMIN";

  const userNavItems = [
    {
      title: "หน้าหลัก",
      href: "/dashboard",
      icon: Home,
    },
    {
      title: "สร้างรายการใหม่",
      href: "/dashboard/welfare-records/new",
      icon: PlusCircle,
    },
    {
      title: "รายการของฉัน",
      href: "/dashboard/welfare-records/my",
      icon: FileText,
    },
    {
      title: "รายการในแผนก",
      href: "/dashboard/welfare-records/department",
      icon: ListChecks,
    },
    {
      title: "โปรไฟล์",
      href: "/dashboard/profile",
      icon: Settings,
    },
  ];

  const adminNavItems = [
    {
      title: "จัดการผู้ใช้งาน",
      href: "/dashboard/admin/users",
      icon: Users,
    },
    {
      title: "จัดการแผนก",
      href: "/dashboard/admin/departments",
      icon: Layers,
    },
    {
      title: "จัดการประเภทรายการ",
      href: "/dashboard/admin/item-types",
      icon: ListChecks,
    },
    {
      title: "อนุมัติรายการ",
      href: "/dashboard/admin/approve",
      icon: FileText,
    },
  ];

  const navItems = isAdmin
    ? [...userNavItems, ...adminNavItems]
    : userNavItems;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">เปิดเมนู</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0">
        <SheetHeader>
          <SheetTitle>ระบบลงคุม</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === item.href
                    ? "bg-accent text-accent-foreground"
                    : "transparent"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
} 