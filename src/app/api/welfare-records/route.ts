import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidateCacheByPattern } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

// GET /api/welfare-records - ดึงข้อมูลรายการสวัสดิการทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "ไม่ได้รับอนุญาต" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const departmentId = (session.user as any).departmentId;

    // สร้าง filter จาก query parameters
    let where: any = {};

    // ถ้าไม่ใช่ admin ให้ดูได้เฉพาะรายการของตัวเองและรายการในแผนก
    if (userRole !== "ADMIN") {
      where.OR = [
        { userId },
        { user: { departmentId } }
      ];
    }

    // เพิ่ม filter ตาม query parameters
    if (search) {
      where.OR = [
        ...(where.OR || []),
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

    return NextResponse.json({
      data: records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching welfare records:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลรายการสวัสดิการ" },
      { status: 500 }
    );
  }
}

// POST /api/welfare-records - สร้างรายการสวัสดิการใหม่
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "ไม่ได้รับอนุญาต" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const departmentId = (session.user as any).departmentId;
    const body = await request.json();
    const { title, description, amount, itemTypeId } = body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!title || !description || !amount || !itemTypeId) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าประเภทรายการมีอยู่จริงหรือไม่
    const itemType = await prisma.itemType.findUnique({
      where: { id: itemTypeId },
    });

    if (!itemType) {
      return NextResponse.json(
        { error: "ไม่พบประเภทรายการที่ระบุ" },
        { status: 400 }
      );
    }

    // สร้างรายการสวัสดิการใหม่
    const newRecord = await prisma.welfareRecord.create({
      data: {
        orderNumber: title,
        correctionDetails: description,
        amount: parseFloat(amount.toString()),
        status: "PENDING",
        recordDate: new Date(),
        userId,
        itemTypeId,
        departmentId,
        isCancelled: false
      },
    });

    // ลบ cache ที่เกี่ยวข้องกับรายการสวัสดิการ
    await invalidateCacheByPattern("welfare-records:*");
    await invalidateCacheByPattern("welfare-records-stats:*");

    return NextResponse.json(newRecord, { status: 201 });
  } catch (error) {
    console.error("Error creating welfare record:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างรายการสวัสดิการ" },
      { status: 500 }
    );
  }
} 