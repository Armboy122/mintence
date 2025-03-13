import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cacheData, getCachedData, invalidateCacheByPattern } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

// GET /api/departments - ดึงข้อมูลแผนกทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // สร้าง cache key จาก query parameters
    const cacheKey = `departments:${search || ''}:${page}:${limit}`;
    
    // ตรวจสอบข้อมูลจาก cache
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // สร้าง filter จาก query parameters
    const where: any = {};
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // ดึงข้อมูลแผนกตาม filter
    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.department.count({ where }),
    ]);

    const result = {
      data: departments,
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
    console.error('Error fetching departments:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/departments - สร้างแผนกใหม่
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!name) {
      return NextResponse.json(
        { error: 'Department name is required' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่ามีชื่อแผนกซ้ำหรือไม่
    const existingDepartment = await prisma.department.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existingDepartment) {
      return NextResponse.json(
        { error: 'Department name already exists' },
        { status: 400 }
      );
    }

    // สร้างแผนกใหม่
    const newDepartment = await prisma.department.create({
      data: {
        name,
      },
    });

    // ลบ cache ที่เกี่ยวข้องกับแผนก
    await invalidateCacheByPattern('departments:*');

    return NextResponse.json(newDepartment, { status: 201 });
  } catch (error) {
    console.error('Error creating department:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 