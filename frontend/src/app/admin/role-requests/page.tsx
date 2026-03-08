"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { toastDanger, toastSuccess } from "@/components/ui/Toast";

type RoleRequestStatus = "pending" | "accepted" | "rejected";

type RoleRequest = {
  requestId: string;
  userId: string;
  requestRole: string;
  status: RoleRequestStatus;
  createdAt: string;
  updatedAt: string | null;
};

export default function AdminRoleRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RoleRequest[]>([]);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/request/pending");
      setRequests(res.data as RoleRequest[]);
    } catch (err) {
      toastDanger("โหลดรายการคำขอไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const approve = async (requestId: string) => {
    try {
      await api.patch(`/request/${requestId}/approve`);
      toastSuccess("อนุมัติคำขอเรียบร้อย");
      await fetchPending();
    } catch {
      toastDanger("อนุมัติไม่สำเร็จ");
    }
  };

  const reject = async (requestId: string) => {
    try {
      await api.patch(`/request/${requestId}/reject`);
      toastSuccess("ปฏิเสธคำขอเรียบร้อย");
      await fetchPending();
    } catch {
      toastDanger("ปฏิเสธไม่สำเร็จ");
    }
  };

  return (
    <div className="container mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl noto-sans-bold text-primary">คำขอเป็นร้านอาหาร</h1>
        <Button type="button" variant="secondary" onClick={fetchPending} disabled={loading}>
          รีเฟรช
        </Button>
      </div>

      {loading ? (
        <div className="text-secondary">กำลังโหลด...</div>
      ) : requests.length === 0 ? (
        <div className="text-secondary">ไม่มีคำขอค้างอยู่</div>
      ) : (
        <div className="flex flex-col gap-y-3">
          {requests.map((r) => (
            <div
              key={r.requestId}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border rounded-xl p-4 bg-white"
            >
              <div className="flex flex-col">
                <div className="text-primary noto-sans-bold">User: {r.userId}</div>
                <div className="text-sm text-secondary">
                  Role: {r.requestRole} • Status: {r.status}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="primary" onClick={() => approve(r.requestId)}>
                  อนุมัติ
                </Button>
                <Button type="button" variant="secondaryDanger" onClick={() => reject(r.requestId)}>
                  ปฏิเสธ
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

