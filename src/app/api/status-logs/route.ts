import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cacheData, getCachedData, invalidateCacheByPattern } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

// GET /api/status-logs - ดึงข้อมูลประวัติการเปลี่ยนแปลงสถานะทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const welfareRecordId = searchParams.get('welfareRecordId');
    const processedById = searchParams.get('processedById');
    const status = searchParams.get('status');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // ตรวจสอบว่ามี welfareRecordId หรือไม่
    if (!welfareRecordId) {
      return NextResponse.json(
        { error: 'Welfare record ID is required' },
        { status: 400 }
      );
    }

    // ตรวจสอบสิทธิ์ในการดูข้อมูล
    if (session.user.role !== 'ADMIN') {
      // ตรวจสอบว่าผู้ใช้มีสิทธิ์ในการดูข้อมูลของรายการสวัสดิการนี้หรือไม่
      const welfareRecord = await prisma.welfareRecord.findUnique({
        where: { id: welfareRecordId },
      });

      if (!welfareRecord) {
        return NextResponse.json({ error: 'Welfare record not found' }, { status: 404 });
      }

      if (
        session.user.id !== welfareRecord.userId &&
        session.user.departmentId !== welfareRecord.departmentId
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // สร้าง cache key จาก query parameters
    const cacheKey = `status-logs:${welfareRecordId}:${processedById || ''}:${status || ''}:${fromDate || ''}:${toDate || ''}:${page}:${limit}`;
    
    // ตรวจสอบข้อมูลจาก cache
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // สร้าง filter จาก query parameters
    const where: any = {
      welfareRecordId,
    };
    
    if (processedById) {
      where.processedById = processedById;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (fromDate) {
      where.timestamp = {
        ...where.timestamp,
        gte: new Date(fromDate),
      };
    }
    
    if (toDate) {
      where.timestamp = {
        ...where.timestamp,
        lte: new Date(toDate),
      };
    }

    // ดึงข้อมูลประวัติการเปลี่ยนแปลงสถานะตาม filter
    const [statusLogs, total] = await Promise.all([
      prisma.statusLog.findMany({
        where,
        include: {
          processedBy: {
            select: {
              id: true,
              name: true,
              employeeId: true,
              email: true,
              role: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          timestamp: 'desc',
        },
      }),
      prisma.statusLog.count({ where }),
    ]);

    const result = {
      data: statusLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // บันทึกข้อมูลลง cache
    await cacheData(cacheKey, result, 300); // cache 5 นาที

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching status logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/status-logs - สร้างประวัติการเปลี่ยนแปลงสถานะใหม่
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { welfareRecordId, status, notes } = body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!welfareRecordId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่ารายการสวัสดิการมีอยู่หรือไม่
    const welfareRecord = await prisma.welfareRecord.findUnique({
      where: { id: welfareRecordId },
    });

    if (!welfareRecord) {
      return NextResponse.json({ error: 'Welfare record not found' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์ในการสร้างประวัติการเปลี่ยนแปลงสถานะ
    // ถ้าเป็น admin สามารถสร้างประวัติการเปลี่ยนแปลงสถานะได้ทุกรายการ
    // ถ้าเป็น user ปกติ สามารถสร้างประวัติการเปลี่ยนแปลงสถานะได้เฉพาะรายการของตัวเองหรือของแผนกตัวเอง
    if (
      session.user.role !== 'ADMIN' &&
      session.user.id !== welfareRecord.userId &&
      session.user.departmentId !== welfareRecord.departmentId
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // สร้างประวัติการเปลี่ยนแปลงสถานะใหม่
    const newStatusLog = await prisma.statusLog.create({
      data: {
        welfareRecordId,
        status,
        notes: notes || `เปลี่ยนสถานะเป็น ${status}`,
        processedById: session.user.id,
        timestamp: new Date(),
      },
      include: {
        processedBy: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // อัปเดตสถานะของรายการสวัสดิการ
    await prisma.welfareRecord.update({
      where: { id: welfareRecordId },
      data: { status },
    });

    // ลบ cache ที่เกี่ยวข้อง
    await invalidateCacheByPattern(`status-logs:${welfareRecordId}:*`);
    await invalidateCacheByPattern(`welfare-record:${welfareRecordId}`);
    await invalidateCacheByPattern('welfare-records:*');

    return NextResponse.json(newStatusLog, { status: 201 });
  } catch (error) {
    console.error('Error creating status log:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 