import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcrypt';
import { cacheData, getCachedData, invalidateCacheByPattern } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

// GET /api/users - ดึงข้อมูลผู้ใช้งานทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // สร้าง cache key จาก query parameters
    const cacheKey = `users:${departmentId || ''}:${role || ''}:${search || ''}:${page}:${limit}`;
    
    // ตรวจสอบข้อมูลจาก cache
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // สร้าง filter จาก query parameters
    const where: any = {};
    if (departmentId) {
      where.departmentId = departmentId;
    }
    if (role) {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    // ดึงข้อมูลผู้ใช้งานตาม filter
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          department: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.user.count({ where }),
    ]);

    // แปลงข้อมูลเพื่อไม่ให้ส่งรหัสผ่านกลับไป
    const safeUsers = users.map(user => {
      const { haspassword, ...safeUser } = user;
      return safeUser;
    });

    const result = {
      data: safeUsers,
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
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/users - สร้างผู้ใช้งานใหม่
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { employeeId, name, email, password, role, departmentId } = body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!employeeId || !name || !email || !password || !departmentId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่ามี email หรือ employeeId ซ้ำหรือไม่
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { employeeId },
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email or Employee ID already exists' },
        { status: 400 }
      );
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await hash(password, 10);

    // สร้างผู้ใช้งานใหม่
    const newUser = await prisma.user.create({
      data: {
        employeeId,
        name,
        email,
        haspassword: hashedPassword,
        role: role || 'USER',
        departmentId,
      },
      include: {
        department: true,
      },
    });

    // ลบ cache ที่เกี่ยวข้องกับผู้ใช้งาน
    await invalidateCacheByPattern('users:*');

    // ไม่ส่งรหัสผ่านกลับไป
    const { haspassword, ...safeUser } = newUser;

    return NextResponse.json(safeUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 