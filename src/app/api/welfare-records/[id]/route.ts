import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cacheData, getCachedData, invalidateCache, invalidateCacheByPattern } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

// GET /api/welfare-records/[id] - ดึงข้อมูลรายการสวัสดิการตาม ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;
    
    // ตรวจสอบข้อมูลจาก cache
    const cacheKey = `welfare-record:${id}`;
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // ดึงข้อมูลรายการสวัสดิการจาก database
    const welfareRecord = await prisma.welfareRecord.findUnique({
      where: { id },
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
        statusLogs: {
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
          orderBy: {
            timestamp: 'desc',
          },
        },
      },
    });

    if (!welfareRecord) {
      return NextResponse.json({ error: 'Welfare record not found' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์ในการดูข้อมูล
    // ถ้าเป็น admin สามารถดูข้อมูลทั้งหมดได้
    // ถ้าเป็น user ปกติ สามารถดูได้เฉพาะข้อมูลของตัวเองหรือของแผนกตัวเอง
    if (
      session.user.role !== 'ADMIN' &&
      session.user.id !== welfareRecord.userId &&
      session.user.departmentId !== welfareRecord.departmentId
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // บันทึกข้อมูลลง cache
    await cacheData(cacheKey, welfareRecord, 60); // cache 1 นาที

    return NextResponse.json(welfareRecord);
  } catch (error) {
    console.error('Error fetching welfare record:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/welfare-records/[id] - อัปเดตข้อมูลรายการสวัสดิการ
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;
    const body = await request.json();
    const {
      orderNumber,
      amount,
      recordDate,
      status,
      correctionDetails,
      isCancelled,
      departureDate,
      returnDate,
      itemTypeId,
      departmentId,
      statusNote,
    } = body;

    // ตรวจสอบว่ารายการสวัสดิการมีอยู่หรือไม่
    const existingRecord = await prisma.welfareRecord.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!existingRecord) {
      return NextResponse.json({ error: 'Welfare record not found' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์ในการแก้ไขข้อมูล
    // ถ้าเป็น admin สามารถแก้ไขข้อมูลทั้งหมดได้
    // ถ้าเป็น user ปกติ สามารถแก้ไขได้เฉพาะข้อมูลของตัวเองและเฉพาะบางฟิลด์เท่านั้น
    const isAdmin = session.user.role === 'ADMIN';
    const isOwner = session.user.id === existingRecord.userId;
    const isDepartmentMember = session.user.departmentId === existingRecord.departmentId;

    if (!isAdmin && !isOwner && !isDepartmentMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // สร้างข้อมูลสำหรับการอัปเดต
    const updateData: any = {};
    
    // ถ้าเป็น admin สามารถอัปเดตได้ทุกฟิลด์
    if (isAdmin) {
      if (orderNumber !== undefined) updateData.orderNumber = orderNumber;
      if (amount !== undefined) updateData.amount = parseFloat(amount);
      if (recordDate) updateData.recordDate = new Date(recordDate);
      if (isCancelled !== undefined) updateData.isCancelled = isCancelled;
      if (departureDate) updateData.departureDate = new Date(departureDate);
      if (returnDate) updateData.returnDate = new Date(returnDate);
      if (itemTypeId) updateData.itemTypeId = itemTypeId;
      if (departmentId) updateData.departmentId = departmentId;
    }
    
    // ถ้าเป็นเจ้าของรายการหรือเป็นสมาชิกในแผนกเดียวกัน สามารถอัปเดตได้บางฟิลด์
    if (isOwner || isDepartmentMember) {
      if (correctionDetails !== undefined) updateData.correctionDetails = correctionDetails;
    }
    
    // ถ้ามีการเปลี่ยนสถานะ
    if (status && status !== existingRecord.status) {
      updateData.status = status;
      
      // สร้างประวัติการเปลี่ยนแปลงสถานะ
      await prisma.statusLog.create({
        data: {
          welfareRecordId: id,
          status,
          notes: statusNote || `เปลี่ยนสถานะจาก ${existingRecord.status} เป็น ${status}`,
          processedById: session.user.id,
          timestamp: new Date(),
        },
      });
    }

    // ถ้าไม่มีข้อมูลที่จะอัปเดต
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No data to update' },
        { status: 400 }
      );
    }

    // อัปเดตข้อมูลรายการสวัสดิการ
    const updatedRecord = await prisma.welfareRecord.update({
      where: { id },
      data: updateData,
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
        statusLogs: {
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
          orderBy: {
            timestamp: 'desc',
          },
        },
      },
    });

    // ลบ cache ที่เกี่ยวข้อง
    await invalidateCache(`welfare-record:${id}`);
    await invalidateCacheByPattern('welfare-records:*');

    return NextResponse.json(updatedRecord);
  } catch (error) {
    console.error('Error updating welfare record:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/welfare-records/[id] - ลบรายการสวัสดิการ
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;

    // ตรวจสอบว่ารายการสวัสดิการมีอยู่หรือไม่
    const existingRecord = await prisma.welfareRecord.findUnique({
      where: { id },
      include: {
        statusLogs: true,
      },
    });

    if (!existingRecord) {
      return NextResponse.json({ error: 'Welfare record not found' }, { status: 404 });
    }

    // ลบประวัติการเปลี่ยนแปลงสถานะก่อน
    if (existingRecord.statusLogs.length > 0) {
      await prisma.statusLog.deleteMany({
        where: { welfareRecordId: id },
      });
    }

    // ลบรายการสวัสดิการ
    await prisma.welfareRecord.delete({
      where: { id },
    });

    // ลบ cache ที่เกี่ยวข้อง
    await invalidateCache(`welfare-record:${id}`);
    await invalidateCacheByPattern('welfare-records:*');

    return NextResponse.json({ message: 'Welfare record deleted successfully' });
  } catch (error) {
    console.error('Error deleting welfare record:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 