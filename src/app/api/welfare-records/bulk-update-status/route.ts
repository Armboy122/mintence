import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidateCacheByPattern } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

// POST /api/welfare-records/bulk-update-status - เปลี่ยนสถานะรายการสวัสดิการแบบหลายรายการพร้อมกัน
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recordIds, status, notes } = body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0 || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่ารายการสวัสดิการทั้งหมดมีอยู่หรือไม่
    const existingRecords = await prisma.welfareRecord.findMany({
      where: {
        id: {
          in: recordIds,
        },
      },
    });

    if (existingRecords.length !== recordIds.length) {
      return NextResponse.json(
        { error: 'Some welfare records not found' },
        { status: 404 }
      );
    }

    // สร้างประวัติการเปลี่ยนแปลงสถานะสำหรับแต่ละรายการ
    const statusLogs = recordIds.map(recordId => ({
      welfareRecordId: recordId,
      status,
      notes: notes || `เปลี่ยนสถานะเป็น ${status} (อัปเดตแบบกลุ่ม)`,
      processedById: session.user.id,
      timestamp: new Date(),
    }));

    // อัปเดตสถานะของรายการสวัสดิการทั้งหมด
    const [updatedRecords, createdStatusLogs] = await prisma.$transaction([
      prisma.welfareRecord.updateMany({
        where: {
          id: {
            in: recordIds,
          },
        },
        data: {
          status,
        },
      }),
      prisma.statusLog.createMany({
        data: statusLogs,
      }),
    ]);

    // ลบ cache ที่เกี่ยวข้อง
    await invalidateCacheByPattern('welfare-records:*');
    for (const recordId of recordIds) {
      await invalidateCacheByPattern(`welfare-record:${recordId}`);
      await invalidateCacheByPattern(`status-logs:${recordId}:*`);
    }

    return NextResponse.json({
      message: `Updated ${updatedRecords.count} welfare records`,
      count: updatedRecords.count,
    });
  } catch (error) {
    console.error('Error bulk updating welfare records:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 