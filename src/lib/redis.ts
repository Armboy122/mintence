import { Redis } from 'ioredis';

// สร้าง Redis client
const redis = new Redis(process.env.REDIS_URL as string);

// ฟังก์ชันสำหรับการ cache ข้อมูล
export async function cacheData<T>(key: string, data: T, ttl: number = 3600): Promise<void> {
  await redis.set(key, JSON.stringify(data), 'EX', ttl);
}

// ฟังก์ชันสำหรับการดึงข้อมูลจาก cache
export async function getCachedData<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  if (!data) return null;
  return JSON.parse(data) as T;
}

// ฟังก์ชันสำหรับการลบข้อมูลจาก cache
export async function invalidateCache(key: string): Promise<void> {
  await redis.del(key);
}

// ฟังก์ชันสำหรับการลบข้อมูลจาก cache ด้วย pattern
export async function invalidateCacheByPattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export default redis; 