import { api } from "@/lib/api";

export type ComplaintTarget = "SYSTEM" | "SCHOOL";
export type ComplaintStatus = "OPEN" | "RESOLVED";

export interface Complaint {
    id: string;
    orderId: string;
    target: ComplaintTarget;
    message: string;
    status: ComplaintStatus;
    createdAt: string;
    resolvedAt: string | null;
    order: { totalAmount: number; restaurant: { name: string } };
    school: { name: string };
}

export const sendComplaint = async (orderId: string, input: { target: ComplaintTarget; message: string }) =>
    (await api.post(`/order/${orderId}/complaint`, input)).data;

export const listSchoolComplaints = async (schoolId: string, status?: ComplaintStatus) =>
    (await api.get<Complaint[]>(`/schools/${schoolId}/complaints`, { params: { status } })).data;
export const resolveSchoolComplaint = async (schoolId: string, id: string) => (await api.patch(`/schools/${schoolId}/complaints/${id}/resolve`)).data;

export const listAdminComplaints = async (status?: ComplaintStatus) => (await api.get<Complaint[]>("/admin/complaints", { params: { status } })).data;
export const resolveAdminComplaint = async (id: string) => (await api.patch(`/admin/complaints/${id}/resolve`)).data;
