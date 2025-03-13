import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cacheData, getCachedData, invalidateCacheByPattern } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

// GET /api/item-types - ดึงข้อมูลประเภทรายการสวัสดิการทั้งหมด
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
    const cacheKey = `item-types:${search || ''}:${page}:${limit}`;
    
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

    // ดึงข้อมูลประเภทรายการสวัสดิการตาม filter
    const [itemTypes, total] = await Promise.all([
      prisma.itemType.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.itemType.count({ where }),
    ]);

    const result = {
      data: itemTypes,
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
    console.error('Error fetching item types:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/item-types - สร้างประเภทรายการสวัสดิการใหม่
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
        { error: 'Item type name is required' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่ามีชื่อประเภทรายการสวัสดิการซ้ำหรือไม่
    const existingItemType = await prisma.itemType.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existingItemType) {
      return NextResponse.json(
        { error: 'Item type name already exists' },
        { status: 400 }
      );
    }

    // สร้างประเภทรายการสวัสดิการใหม่
    const newItemType = await prisma.itemType.create({
      data: {
        name,
      },
    });

    // ลบ cache ที่เกี่ยวข้องกับประเภทรายการสวัสดิการ
    await invalidateCacheByPattern('item-types:*');

    return NextResponse.json(newItemType, { status: 201 });
  } catch (error) {
    console.error('Error creating item type:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 