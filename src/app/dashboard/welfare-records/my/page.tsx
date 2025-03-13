"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, Plus, FileText, Clock, CheckCircle, XCircle } from "lucide-react";

// กำหนดประเภทข้อมูลสำหรับ WelfareRecord
interface WelfareRecord {
  id: string;
  orderNumber: string;
  correctionDetails: string;
  amount: number;
  status: string;
  recordDate: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  itemTypeId: string;
  departmentId: string;
  isCancelled: boolean;
  itemType: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    department: {
      id: string;
      name: string;
    };
  };
}

// ฟังก์ชันสำหรับแปลงสถานะเป็นภาษาไทย
const getStatusText = (status: string) => {
  switch (status) {
    case "PENDING":
      return "รอการอนุมัติ";
    case "APPROVED":
      return "อนุมัติแล้ว";
    case "REJECTED":
      return "ไม่อนุมัติ";
    default:
      return status;
  }
};

// ฟังก์ชันสำหรับแสดงสีของ Badge ตามสถานะ
const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "PENDING":
      return "outline";
    case "APPROVED":
      return "secondary";
    case "REJECTED":
      return "destructive";
    default:
      return "secondary";
  }
};

// ฟังก์ชันสำหรับแสดงไอคอนตามสถานะ
const getStatusIcon = (status: string) => {
  switch (status) {
    case "PENDING":
      return <Clock className="h-4 w-4" />;
    case "APPROVED":
      return <CheckCircle className="h-4 w-4" />;
    case "REJECTED":
      return <XCircle className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

// ฟังก์ชันสำหรับแปลงวันที่เป็นรูปแบบไทย
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ฟังก์ชันสำหรับแปลงจำนวนเงินเป็นรูปแบบไทย
const formatAmount = (amount: number) => {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
  }).format(amount);
};

export default function MyWelfareRecordsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [records, setRecords] = useState<WelfareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // ดึงข้อมูลรายการสวัสดิการ
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      // สร้าง query parameters
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter) params.append("status", statusFilter);
      params.append("page", currentPage.toString());
      params.append("limit", "10");

      const response = await fetch(`/api/welfare-records/my?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotalRecords(data.pagination.total);
      } else {
        toast.error("ไม่สามารถดึงข้อมูลรายการได้");
      }
    } catch (error) {
      console.error("Error fetching records:", error);
      toast.error("เกิดข้อผิดพลาดในการดึงข้อมูลรายการ");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, currentPage]);

  // เรียกใช้ fetchRecords เมื่อมีการเปลี่ยนแปลง filters หรือหน้า
  useEffect(() => {
    if (session?.user) {
      fetchRecords();
    }
  }, [session, searchTerm, statusFilter, currentPage, fetchRecords]);

  // ฟังก์ชันสำหรับการค้นหา
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // รีเซ็ตหน้าเป็นหน้าแรกเมื่อค้นหา
    fetchRecords();
  };

  // ฟังก์ชันสำหรับการเปลี่ยนสถานะ
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1); // รีเซ็ตหน้าเป็นหน้าแรกเมื่อเปลี่ยนสถานะ
  };

  // ฟังก์ชันสำหรับการเปลี่ยนหน้า
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // ฟังก์ชันสำหรับการสร้างรายการใหม่
  const handleCreateNew = () => {
    router.push("/dashboard/welfare-records/new");
  };

  // ฟังก์ชันสำหรับการดูรายละเอียด
  const handleViewDetails = (id: string) => {
    router.push(`/dashboard/welfare-records/${id}`);
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">รายการของฉัน</h2>
        <Button onClick={handleCreateNew}>
          <Plus className="mr-2 h-4 w-4" /> สร้างรายการใหม่
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>รายการสวัสดิการของฉัน</CardTitle>
          <CardDescription>
            รายการสวัสดิการทั้งหมดที่คุณได้สร้างไว้
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col space-y-2 md:flex-row md:space-x-2 md:space-y-0">
              <form
                onSubmit={handleSearch}
                className="flex flex-1 space-x-2"
              >
                <Input
                  placeholder="ค้นหารายการ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" variant="secondary">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
              <Select
                value={statusFilter}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="สถานะทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">สถานะทั้งหมด</SelectItem>
                  <SelectItem value="PENDING">รอการอนุมัติ</SelectItem>
                  <SelectItem value="APPROVED">อนุมัติแล้ว</SelectItem>
                  <SelectItem value="REJECTED">ไม่อนุมัติ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <Skeleton className="h-12 flex-1" />
                  </div>
                ))}
              </div>
            ) : records.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เลขที่คำสั่ง</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead className="hidden md:table-cell">
                        จำนวนเงิน
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        วันที่ลงรายการ
                      </TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">การจัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {record.orderNumber || "-"}
                        </TableCell>
                        <TableCell>{record.itemType.name}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {formatAmount(record.amount)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {formatDate(record.recordDate)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              getStatusBadgeVariant(
                                record.status
                              ) as "outline" | "secondary" | "destructive"
                            }
                            className="flex w-fit items-center gap-1"
                          >
                            {getStatusIcon(record.status)}
                            {getStatusText(record.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(record.id)}
                          >
                            รายละเอียด
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed">
                <div className="flex flex-col items-center space-y-2 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">ไม่พบรายการ</h3>
                  <p className="text-sm text-muted-foreground">
                    ยังไม่มีรายการสวัสดิการที่คุณสร้าง หรือไม่ตรงกับเงื่อนไขการค้นหา
                  </p>
                </div>
              </div>
            )}

            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    {currentPage > 1 ? (
                      <PaginationPrevious onClick={() => handlePageChange(currentPage - 1)} />
                    ) : (
                      <PaginationPrevious className="pointer-events-none opacity-50" />
                    )}
                  </PaginationItem>
                  {Array.from({ length: totalPages }).map((_, index) => (
                    <PaginationItem key={index}>
                      <PaginationLink
                        onClick={() => handlePageChange(index + 1)}
                        isActive={currentPage === index + 1}
                      >
                        {index + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    {currentPage < totalPages ? (
                      <PaginationNext onClick={() => handlePageChange(currentPage + 1)} />
                    ) : (
                      <PaginationNext className="pointer-events-none opacity-50" />
                    )}
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}

            <div className="text-sm text-muted-foreground">
              แสดง {records.length} รายการ จากทั้งหมด {totalRecords} รายการ
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 