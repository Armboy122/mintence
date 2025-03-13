import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "ไม่ได้รับอนุญาต" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const departmentId = (session.user as any).departmentId;

    let whereClause = {};

    if (userRole !== "ADMIN") {
      // ถ้าเป็นผู้ใช้ทั่วไป ให้ดูได้เฉพาะรายการของตัวเองและรายการในแผนก
      whereClause = {
        OR: [
          { userId },
          { user: { departmentId } }
        ]
      };
    }

    // นับจำนวนรายการทั้งหมด
    const total = await prisma.welfareRecord.count({
      where: whereClause,
    });

    // นับจำนวนรายการตามสถานะ
    const pending = await prisma.welfareRecord.count({
      where: {
        ...whereClause,
        status: "PENDING",
      },
    });

    const approved = await prisma.welfareRecord.count({
      where: {
        ...whereClause,
        status: "APPROVED",
      },
    });

    const rejected = await prisma.welfareRecord.count({
      where: {
        ...whereClause,
        status: "REJECTED",
      },
    });

    return NextResponse.json({
      total,
      pending,
      approved,
      rejected,
    });
  } catch (error) {
    console.error("Error fetching welfare record stats:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ" },
      { status: 500 }
    );
  }
} 