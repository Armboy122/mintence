"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// สร้าง schema สำหรับตรวจสอบข้อมูล
const formSchema = z.object({
  orderNumber: z.string().min(3, {
    message: "เลขที่คำสั่งต้องมีอย่างน้อย 3 ตัวอักษร",
  }),
  correctionDetails: z.string().min(10, {
    message: "รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร",
  }),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "จำนวนเงินต้องเป็นตัวเลขและมากกว่า 0",
  }),
  itemTypeId: z.string({
    required_error: "กรุณาเลือกประเภทรายการ",
  }),
});

export default function NewWelfareRecordPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [itemTypes, setItemTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingItemTypes, setIsLoadingItemTypes] = useState(true);

  // สร้าง form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderNumber: "",
      correctionDetails: "",
      amount: "",
      itemTypeId: "",
    },
  });

  // ดึงข้อมูลประเภทรายการเมื่อโหลดหน้า
  useEffect(() => {
    const fetchItemTypes = async () => {
      try {
        const response = await fetch("/api/item-types/all");
        if (response.ok) {
          const data = await response.json();
          setItemTypes(data);
        } else {
          toast.error("ไม่สามารถดึงข้อมูลประเภทรายการได้");
        }
      } catch (error) {
        console.error("Error fetching item types:", error);
        toast.error("เกิดข้อผิดพลาดในการดึงข้อมูลประเภทรายการ");
      } finally {
        setIsLoadingItemTypes(false);
      }
    };

    fetchItemTypes();
  }, []);

  // ส่งข้อมูลฟอร์ม
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!session?.user) {
      toast.error("กรุณาเข้าสู่ระบบก่อนทำรายการ");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/welfare-records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: values.orderNumber,
          description: values.correctionDetails,
          amount: parseFloat(values.amount),
          itemTypeId: values.itemTypeId,
        }),
      });

      if (response.ok) {
        toast.success("สร้างรายการสำเร็จ");
        router.push("/dashboard/welfare-records/my");
        router.refresh();
      } else {
        const data = await response.json();
        toast.error(data.error || "ไม่สามารถสร้างรายการได้");
      }
    } catch (error) {
      console.error("Error creating welfare record:", error);
      toast.error("เกิดข้อผิดพลาดในการสร้างรายการ");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">สร้างรายการใหม่</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>กรอกข้อมูลรายการ</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="orderNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เลขที่คำสั่ง</FormLabel>
                    <FormControl>
                      <Input placeholder="ระบุเลขที่คำสั่ง" {...field} />
                    </FormControl>
                    <FormDescription>
                      เลขที่คำสั่งหรือชื่อรายการที่ต้องการเบิก เช่น ค่ารักษาพยาบาล, ค่าเล่าเรียนบุตร
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="correctionDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>รายละเอียด</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="ระบุรายละเอียดเพิ่มเติม"
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      รายละเอียดเพิ่มเติมของรายการ เช่น วันที่เกิดค่าใช้จ่าย, สถานที่, เหตุผล
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>จำนวนเงิน (บาท)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="itemTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ประเภทรายการ</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isLoadingItemTypes}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="เลือกประเภทรายการ" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {itemTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "กำลังบันทึก..." : "บันทึกรายการ"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
} 