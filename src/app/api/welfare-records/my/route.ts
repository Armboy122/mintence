import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { cacheData, getCachedData } from "@/lib/redis";
import { authOptions } from "../../auth/[...nextauth]/route";

// GET /api/welfare-records/my - ดึงข้อมูลรายการสวัสดิการของผู้ใช้ที่ล็อกอินอยู่
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "ไม่ได้รับอนุญาต" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // สร้าง cache key จาก query parameters
    const cacheKey = `welfare-records:my:${userId}:${search || ""}:${status || ""}:${page}:${limit}`;
    
    // ตรวจสอบข้อมูลจาก cache
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // สร้าง filter จาก query parameters
    let where: any = {
      userId, // ดึงเฉพาะรายการของผู้ใช้ที่ล็อกอินอยู่
    };

    // เพิ่ม filter ตาม query parameters
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { correctionDetails: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    // ดึงข้อมูลรายการสวัสดิการตาม filter
    const [records, total] = await Promise.all([
      prisma.welfareRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          itemType: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.welfareRecord.count({ where }),
    ]);

    const result = {
      data: records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // บันทึกข้อมูลลง cache
    await cacheData(cacheKey, result, 60); // cache 1 นาที

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching my welfare records:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลรายการสวัสดิการ" },
      { status: 500 }
    );
  }
} 