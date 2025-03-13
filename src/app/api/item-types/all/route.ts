import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { cacheData, getCachedData } from "@/lib/redis";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "ไม่ได้รับอนุญาต" },
        { status: 401 }
      );
    }

    // สร้าง cache key
    const cacheKey = "item-types:all";
    
    // ตรวจสอบข้อมูลจาก cache
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // ดึงข้อมูลประเภทรายการทั้งหมด
    const itemTypes = await prisma.itemType.findMany({
      orderBy: {
        name: "asc",
      },
    });

    // บันทึกข้อมูลลง cache
    await cacheData(cacheKey, itemTypes, 300); // cache 5 นาที

    return NextResponse.json(itemTypes);
  } catch (error) {
    console.error("Error fetching all item types:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลประเภทรายการ" },
      { status: 500 }
    );
  }
} 