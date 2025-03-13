โครงสร้างแอพลงคุม  // This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

// Looking for ways to speed up your queries, or scale easily with your serverless or edge functions?
// Try Prisma Accelerate: https://pris.ly/cli/accelerate-init

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// โมเดลผู้ใช้งาน/พนักงาน
model User {
  id           String          @id @default(uuid())
  employeeId   String          @unique // รหัสพนักงาน (ไม่ซ้ำกัน)
  name         String          // ชื่อพนักงาน
  email        String          @unique // อีเมลพนักงาน (ไม่ซ้ำกัน)
  haspassword  String          // รหัสผ่าน (ควรเข้ารหัสก่อนบันทึก)
  role         String          @default("USER") // บทบาทผู้ใช้ (USER หรือ ADMIN)
  departmentId String          // รหัสแผนก (foreign key)
  department   Department      @relation(fields: [departmentId], references: [id]) // ความสัมพันธ์กับแผนก
  welfareRecords WelfareRecord[] // รายการสวัสดิการของพนักงาน
  statusLogs   StatusLog[]     // ประวัติการดำเนินการโดยพนักงาน
  createdAt    DateTime        @default(now()) // วันที่สร้าง
  updatedAt    DateTime        @updatedAt // วันที่อัปเดตล่าสุด
}

// โมเดลแผนก
model Department {
  id        String          @id @default(uuid())
  name      String          // ชื่อแผนก
  users     User[]          // พนักงานในแผนก
  welfareRecords WelfareRecord[] // รายการสวัสดิการของแผนก
  createdAt DateTime        @default(now()) // วันที่สร้าง
  updatedAt DateTime        @updatedAt // วันที่อัปเดตล่าสุด
}

// โมเดลประเภทรายการสวัสดิการ
model ItemType {
  id        String          @id @default(uuid())
  name      String          // ชื่อประเภทรายการ
  welfareRecords WelfareRecord[] // รายการสวัสดิการที่เกี่ยวข้อง
  createdAt DateTime        @default(now()) // วันที่สร้าง
  updatedAt DateTime        @updatedAt // วันที่อัปเดตล่าสุด
}

// โมเดลรายการสวัสดิการ
model WelfareRecord {
  id                String      @id @default(uuid())
  orderNumber      String?     // เลขที่คำสั่ง (ไม่บังคับ)
  amount           Decimal     // จำนวนเงิน
  recordDate       DateTime    // วันที่ลงรายการ
  status           String      // สถานะปัจจุบัน (เช่น "รอดำเนินการ", "อนุมัติแล้ว")
  correctionDetails String?    // รายละเอียดการแก้ไข (ถ้ามี)
  isCancelled      Boolean     @default(false) // สถานะการยกเลิก (false = ไม่ยกเลิก)
  departureDate    DateTime?   // วันที่เดินทางไป (ไม่บังคับ)
  returnDate       DateTime?   // วันที่เดินทางกลับ (ไม่บังคับ)
  userId           String      // รหัสพนักงาน (foreign key)
  user             User        @relation(fields: [userId], references: [id]) // ความสัมพันธ์กับพนักงาน
  itemTypeId       String      // รหัสประเภทรายการ (foreign key)
  itemType         ItemType    @relation(fields: [itemTypeId], references: [id]) // ความสัมพันธ์กับประเภทรายการ
  departmentId     String      // รหัสแผนก (foreign key)
  department       Department  @relation(fields: [departmentId], references: [id]) // ความสัมพันธ์กับแผนก
  statusLogs       StatusLog[] // ประวัติการเปลี่ยนแปลงสถานะ
  createdAt        DateTime    @default(now()) // วันที่สร้าง
  updatedAt        DateTime    @updatedAt // วันที่อัปเดตล่าสุด
}

// โมเดลบันทึกสถานะ (คล้ายระบบติดตามพัสดุ)
model StatusLog {
  id              String        @id @default(uuid())
  welfareRecordId String        // รหัสรายการสวัสดิการ (foreign key)
  welfareRecord   WelfareRecord @relation(fields: [welfareRecordId], references: [id]) // ความสัมพันธ์กับรายการสวัสดิการ
  status          String        // สถานะ (เช่น "รอดำเนินการ", "อนุมัติแล้ว", "ขอแก้ไข")
  notes           String?       // หมายเหตุ (ถ้ามี)
  processedById   String        // รหัสผู้ดำเนินการ (foreign key)
  processedBy     User          @relation(fields: [processedById], references: [id]) // ความสัมพันธ์กับผู้ดำเนินการ
  timestamp       DateTime      // วันเวลาที่เปลี่ยนสถานะ
  createdAt       DateTime      @default(now()) // วันที่สร้าง
}

# mintence
