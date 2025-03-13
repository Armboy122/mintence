import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cacheData, getCachedData, invalidateCacheByPattern } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

// GET /api/welfare-records - ดึงข้อมูลรายการสวัสดิการทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const departmentId = searchParams.get('departmentId');
    const itemTypeId = searchParams.get('itemTypeId');
    const status = searchParams.get('status');
    const isCancelled = searchParams.get('isCancelled');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // สร้าง cache key จาก query parameters
    const cacheKey = `welfare-records:${userId || ''}:${departmentId || ''}:${itemTypeId || ''}:${status || ''}:${isCancelled || ''}:${fromDate || ''}:${toDate || ''}:${search || ''}:${page}:${limit}`;
    
    // ตรวจสอบข้อมูลจาก cache
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // สร้าง filter จาก query parameters
    const where: any = {};
    
    // ถ้าเป็น admin สามารถดูข้อมูลทั้งหมดได้
    // ถ้าเป็น user ปกติ สามารถดูได้เฉพาะข้อมูลของตัวเองหรือของแผนกตัวเอง
    if (session.user.role !== 'ADMIN') {
      where.OR = [
        { userId: session.user.id },
        { departmentId: session.user.departmentId },
      ];
    }
    
    // เพิ่ม filter ตาม query parameters
    if (userId) {
      where.userId = userId;
    }
    
    if (departmentId) {
      where.departmentId = departmentId;
    }
    
    if (itemTypeId) {
      where.itemTypeId = itemTypeId;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (isCancelled) {
      where.isCancelled = isCancelled === 'true';
    }
    
    if (fromDate) {
      where.recordDate = {
        ...where.recordDate,
        gte: new Date(fromDate),
      };
    }
    
    if (toDate) {
      where.recordDate = {
        ...where.recordDate,
        lte: new Date(toDate),
      };
    }
    
    if (search) {
      where.OR = [
        ...(where.OR || []),
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { employeeId: { contains: search, mode: 'insensitive' } } },
        { department: { name: { contains: search, mode: 'insensitive' } } },
        { itemType: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // ดึงข้อมูลรายการสวัสดิการตาม filter
    const [welfareRecords, total] = await Promise.all([
      prisma.welfareRecord.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              employeeId: true,
              email: true,
              role: true,
              departmentId: true,
              department: true,
            },
          },
          department: true,
          itemType: true,
        },
        skip,
        take: limit,
        orderBy: {
          recordDate: 'desc',
        },
      }),
      prisma.welfareRecord.count({ where }),
    ]);

    const result = {
      data: welfareRecords,
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
    console.error('Error fetching welfare records:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/welfare-records - สร้างรายการสวัสดิการใหม่
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      orderNumber,
      amount,
      recordDate,
      status,
      correctionDetails,
      departureDate,
      returnDate,
      userId,
      itemTypeId,
      departmentId,
    } = body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!amount || !recordDate || !status || !userId || !itemTypeId || !departmentId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าผู้ใช้มีสิทธิ์ในการสร้างรายการสวัสดิการหรือไม่
    // ถ้าเป็น admin สามารถสร้างรายการให้ใครก็ได้
    // ถ้าเป็น user ปกติ สามารถสร้างรายการให้ตัวเองเท่านั้น
    if (session.user.role !== 'ADMIN' && session.user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // สร้างรายการสวัสดิการใหม่
    const newWelfareRecord = await prisma.welfareRecord.create({
      data: {
        orderNumber,
        amount: parseFloat(amount),
        recordDate: new Date(recordDate),
        status,
        correctionDetails,
        departureDate: departureDate ? new Date(departureDate) : null,
        returnDate: returnDate ? new Date(returnDate) : null,
        userId,
        itemTypeId,
        departmentId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            email: true,
            role: true,
            departmentId: true,
            department: true,
          },
        },
        department: true,
        itemType: true,
      },
    });

    // สร้างประวัติการเปลี่ยนแปลงสถานะ
    await prisma.statusLog.create({
      data: {
        welfareRecordId: newWelfareRecord.id,
        status,
        notes: 'สร้างรายการใหม่',
        processedById: session.user.id,
        timestamp: new Date(),
      },
    });

    // ลบ cache ที่เกี่ยวข้องกับรายการสวัสดิการ
    await invalidateCacheByPattern('welfare-records:*');

    return NextResponse.json(newWelfareRecord, { status: 201 });
  } catch (error) {
    console.error('Error creating welfare record:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 