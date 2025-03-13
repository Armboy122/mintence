import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cacheData, getCachedData, invalidateCache, invalidateCacheByPattern } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

// GET /api/item-types/[id] - ดึงข้อมูลประเภทรายการสวัสดิการตาม ID
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
    const cacheKey = `item-type:${id}`;
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // ดึงข้อมูลประเภทรายการสวัสดิการจาก database
    const itemType = await prisma.itemType.findUnique({
      where: { id },
    });

    if (!itemType) {
      return NextResponse.json({ error: 'Item type not found' }, { status: 404 });
    }

    // บันทึกข้อมูลลง cache
    await cacheData(cacheKey, itemType, 300); // cache 5 นาที

    return NextResponse.json(itemType);
  } catch (error) {
    console.error('Error fetching item type:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/item-types/[id] - อัปเดตข้อมูลประเภทรายการสวัสดิการ
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
        { error: 'Item type name is required' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าประเภทรายการสวัสดิการมีอยู่หรือไม่
    const existingItemType = await prisma.itemType.findUnique({
      where: { id },
    });

    if (!existingItemType) {
      return NextResponse.json({ error: 'Item type not found' }, { status: 404 });
    }

    // ตรวจสอบว่ามีชื่อประเภทรายการสวัสดิการซ้ำหรือไม่
    if (name !== existingItemType.name) {
      const nameExists = await prisma.itemType.findFirst({
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
          { error: 'Item type name already exists' },
          { status: 400 }
        );
      }
    }

    // อัปเดตข้อมูลประเภทรายการสวัสดิการ
    const updatedItemType = await prisma.itemType.update({
      where: { id },
      data: { name },
    });

    // ลบ cache ที่เกี่ยวข้อง
    await invalidateCache(`item-type:${id}`);
    await invalidateCacheByPattern('item-types:*');

    return NextResponse.json(updatedItemType);
  } catch (error) {
    console.error('Error updating item type:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/item-types/[id] - ลบประเภทรายการสวัสดิการ
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

    // ตรวจสอบว่าประเภทรายการสวัสดิการมีอยู่หรือไม่
    const existingItemType = await prisma.itemType.findUnique({
      where: { id },
    });

    if (!existingItemType) {
      return NextResponse.json({ error: 'Item type not found' }, { status: 404 });
    }

    // ตรวจสอบว่าประเภทรายการสวัสดิการมีรายการสวัสดิการหรือไม่
    const welfareRecords = await prisma.welfareRecord.findFirst({
      where: { itemTypeId: id },
    });

    if (welfareRecords) {
      return NextResponse.json(
        { error: 'Cannot delete item type with welfare records' },
        { status: 400 }
      );
    }

    // ลบประเภทรายการสวัสดิการ
    await prisma.itemType.delete({
      where: { id },
    });

    // ลบ cache ที่เกี่ยวข้อง
    await invalidateCache(`item-type:${id}`);
    await invalidateCacheByPattern('item-types:*');

    return NextResponse.json({ message: 'Item type deleted successfully' });
  } catch (error) {
    console.error('Error deleting item type:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 