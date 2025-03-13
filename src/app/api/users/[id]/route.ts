import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcrypt';
import { cacheData, getCachedData, invalidateCache, invalidateCacheByPattern } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

// GET /api/users/[id] - ดึงข้อมูลผู้ใช้งานตาม ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ตรวจสอบสิทธิ์ (ผู้ใช้สามารถดูข้อมูลตัวเองได้ หรือ admin สามารถดูข้อมูลของทุกคนได้)
    if (session.user.id !== params.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const id = params.id;
    
    // ตรวจสอบข้อมูลจาก cache
    const cacheKey = `user:${id}`;
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // ดึงข้อมูลผู้ใช้งานจาก database
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ไม่ส่งรหัสผ่านกลับไป
    const { haspassword, ...safeUser } = user;

    // บันทึกข้อมูลลง cache
    await cacheData(cacheKey, safeUser, 300); // cache 5 นาที

    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/users/[id] - อัปเดตข้อมูลผู้ใช้งาน
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ตรวจสอบสิทธิ์ (ผู้ใช้สามารถแก้ไขข้อมูลตัวเองได้ หรือ admin สามารถแก้ไขข้อมูลของทุกคนได้)
    if (session.user.id !== params.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const id = params.id;
    const body = await request.json();
    const { name, email, password, role, departmentId } = body;

    // ตรวจสอบว่าผู้ใช้มีอยู่หรือไม่
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ตรวจสอบว่า email ซ้ำกับผู้ใช้อื่นหรือไม่
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email,
          id: { not: id },
        },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        );
      }
    }

    // สร้างข้อมูลสำหรับการอัปเดต
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.haspassword = await hash(password, 10);
    
    // เฉพาะ admin เท่านั้นที่สามารถเปลี่ยน role และ departmentId ได้
    if (session.user.role === 'ADMIN') {
      if (role) updateData.role = role;
      if (departmentId) updateData.departmentId = departmentId;
    }

    // อัปเดตข้อมูลผู้ใช้งาน
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        department: true,
      },
    });

    // ลบ cache ที่เกี่ยวข้อง
    await invalidateCache(`user:${id}`);
    await invalidateCacheByPattern('users:*');

    // ไม่ส่งรหัสผ่านกลับไป
    const { haspassword, ...safeUser } = updatedUser;

    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/users/[id] - ลบผู้ใช้งาน
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

    // ตรวจสอบว่าผู้ใช้มีอยู่หรือไม่
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ตรวจสอบว่าผู้ใช้มีรายการสวัสดิการหรือไม่
    const welfareRecords = await prisma.welfareRecord.findFirst({
      where: { userId: id },
    });

    if (welfareRecords) {
      return NextResponse.json(
        { error: 'Cannot delete user with welfare records' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าผู้ใช้มีประวัติการดำเนินการหรือไม่
    const statusLogs = await prisma.statusLog.findFirst({
      where: { processedById: id },
    });

    if (statusLogs) {
      return NextResponse.json(
        { error: 'Cannot delete user with status logs' },
        { status: 400 }
      );
    }

    // ลบผู้ใช้งาน
    await prisma.user.delete({
      where: { id },
    });

    // ลบ cache ที่เกี่ยวข้อง
    await invalidateCache(`user:${id}`);
    await invalidateCacheByPattern('users:*');

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 