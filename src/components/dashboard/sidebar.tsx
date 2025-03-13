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
} from "lucide-react";

interface SidebarProps {
  user: User;
  className?: string;
}

export function Sidebar({ user, className }: SidebarProps) {
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
    <div className={cn("pb-12", className)}>
      <div className="space-y-4 py-4">
        <div className="px-4 py-2">
          <h2 className="mb-2 px-2 text-lg font-semibold tracking-tight">
            เมนูหลัก
          </h2>
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  pathname === item.href
                    ? "bg-accent text-accent-foreground"
                    : "transparent"
                )}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 