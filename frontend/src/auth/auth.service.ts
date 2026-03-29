import { api } from "@/lib/api"
import { User } from "./auth.types"
import axios from "axios"

export async function loginApi(email: string, password: string) {
    try {
        const res = await api.post("/auth/login", { email, password }, {
            headers: { skipAuth: "true" }
        });
        
        return res.data
    } catch(err) {
        throw err;
    }
}

export async function logoutApi() {
    await api.post("/auth/logout", undefined, {
        headers: { skipAuth: "true" }
    })
}

export async function getProfileApi(): Promise<User> {
    try {
        const res = await api.get("/user/profile")
        return res.data
    } catch (err) {
        if (axios.isAxiosError(err)) {
            const status = err.response?.status;

            if (status === 401) {
                throw new Error("โทเคนหมดอายุ");
            }

            if (status === 403) {
                throw new Error("การเข้าถึงถูกปฏิเสธ");
            }

            if (status === 404) {
                throw new Error("ไม่พบผู้ใช้งาน");
            }

            // Network or other errors
            if (err.code === 'ECONNABORTED') {
                throw new Error("เครือข่ายขัดข้อง");
            }
        }

        throw err;
    }
}

export async function fetchCsrfTokenApi() {
    const res = await api.get("/csrf-token")
    return res.data.csrfToken
}