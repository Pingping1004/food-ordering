"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { toastDanger, toastSuccess } from "@/components/ui/Toast";

type RoleRequestStatus = "pending" | "accepted" | "rejected";

type RoleRequest = {
  requestId: string;
  userId: string;
  username: string;
  requestRole: string;
  status: RoleRequestStatus;
  createdAt: string;
  updatedAt: string | null;
};

export default function AdminRoleRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/request/all");
      setRoleRequests(res.data as RoleRequest[]);
    } catch (err) {
      toastDanger("โหลดรายการคำขอไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const approve = async (requestId: string) => {
    try {
      await api.patch(`/request/${requestId}/approve`);
      toastSuccess("อนุมัติคำขอเรียบร้อย");
      await fetchData();
    } catch {
      toastDanger("อนุมัติไม่สำเร็จ");
    }
  };

  const reject = async (requestId: string) => {
    try {
      await api.patch(`/request/${requestId}/reject`);
      toastSuccess("ปฏิเสธคำขอเรียบร้อย");
      await fetchData();
    } catch {
      toastDanger("ปฏิเสธไม่สำเร็จ");
    }
  };

  const [navbarState, setNavbarState] = useState<RoleRequestStatus>("pending");
  const filterStateRoleRequest = roleRequests.filter((request) => request.status === navbarState)

  return (
    <div className="container mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl noto-sans-bold text-primary">คำขอเป็นร้านอาหาร</h1>
        <Button type="button" variant="secondary" onClick={fetchData} disabled={loading}>
          รีเฟรช
        </Button>
      </div>

      {loading ? (
        <div className="text-secondary">กำลังโหลด...</div>
      ) : roleRequests.length === 0 && !roleRequests ? (
        <div className="text-secondary">ไม่มีคำขอค้างอยู่</div>
      ) : (
        <div className="flex flex-col gap-y-3">

          <div className="flex w-full items-center justify-center -mx-6 pb-4 min-w-lvw text-light text-sm">
            <button
              className={`w-1/2 p-2 ${navbarState === "pending" ? "text-primary border-b-2 border-primary-main" : ""}`}
              onClick={() => setNavbarState("pending")}
            >
              Pending
            </button>
            
            <button 
              className={`w-1/2 p-2 ${navbarState === "accepted" ? "text-primary border-b-2 border-primary-main" : ""}`}
              onClick={() => setNavbarState("accepted")}
            >
              Accepted
            </button>

            <button 
              className={`w-1/2 p-2 ${navbarState === "rejected" ? "text-primary border-b-2 border-primary-main" : ""}`}
              onClick={() => setNavbarState("rejected")}
            >
              Rejected
            </button>
          </div>

          {filterStateRoleRequest.map((r) => (
            // Role request
            <div
              key={r.requestId}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border rounded-xl p-4 bg-white"
            >
              <div className="flex flex-col">
                <div className="text-primary noto-sans-bold">User: {r.username}</div>
                <div className="text-sm text-secondary">
                  Request to be: {r.requestRole} • Status: {r.status}
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

