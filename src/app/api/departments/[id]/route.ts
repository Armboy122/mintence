import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cacheData, getCachedData, invalidateCache, invalidateCacheByPattern } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

// GET /api/departments/[id] - ดึงข้อมูลแผนกตาม ID
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
    const cacheKey = `department:${id}`;
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // ดึงข้อมูลแผนกจาก database
    const department = await prisma.department.findUnique({
      where: { id },
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // บันทึกข้อมูลลง cache
    await cacheData(cacheKey, department, 300); // cache 5 นาที

    return NextResponse.json(department);
  } catch (error) {
    console.error('Error fetching department:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/departments/[id] - อัปเดตข้อมูลแผนก
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;
    const body = await request.json();
    const { name } = body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!name) {
      return NextResponse.json(
        { error: 'Department name is required' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าแผนกมีอยู่หรือไม่
    const existingDepartment = await prisma.department.findUnique({
      where: { id },
    });

    if (!existingDepartment) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // ตรวจสอบว่ามีชื่อแผนกซ้ำหรือไม่
    if (name !== existingDepartment.name) {
      const nameExists = await prisma.department.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
          id: { not: id },
        },
      });

      if (nameExists) {
        return NextResponse.json(
          { error: 'Department name already exists' },
          { status: 400 }
        );
      }
    }

    // อัปเดตข้อมูลแผนก
    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: { name },
    });

    // ลบ cache ที่เกี่ยวข้อง
    await invalidateCache(`department:${id}`);
    await invalidateCacheByPattern('departments:*');

    return NextResponse.json(updatedDepartment);
  } catch (error) {
    console.error('Error updating department:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/departments/[id] - ลบแผนก
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

    // ตรวจสอบว่าแผนกมีอยู่หรือไม่
    const existingDepartment = await prisma.department.findUnique({
      where: { id },
    });

    if (!existingDepartment) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // ตรวจสอบว่าแผนกมีผู้ใช้งานหรือไม่
    const users = await prisma.user.findFirst({
      where: { departmentId: id },
    });

    if (users) {
      return NextResponse.json(
        { error: 'Cannot delete department with users' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าแผนกมีรายการสวัสดิการหรือไม่
    const welfareRecords = await prisma.welfareRecord.findFirst({
      where: { departmentId: id },
    });

    if (welfareRecords) {
      return NextResponse.json(
        { error: 'Cannot delete department with welfare records' },
        { status: 400 }
      );
    }

    // ลบแผนก
    await prisma.department.delete({
      where: { id },
    });

    // ลบ cache ที่เกี่ยวข้อง
    await invalidateCache(`department:${id}`);
    await invalidateCacheByPattern('departments:*');

    return NextResponse.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 