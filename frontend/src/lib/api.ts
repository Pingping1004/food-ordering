import axios, { AxiosRequestConfig, AxiosError, AxiosHeaders } from "axios";
import { setAccessToken, clearTokens, removeAccessToken, clearCsrfToken, fetchOrGetCsrfToken, getAccessToken } from "./token";
import { logoutApi } from "@/auth/auth.service";

type ApiErrorResponse = {
    message?: string;
    code?: string;
};

const baseBackendUrl = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api`;

export const api = axios.create({
    baseURL: baseBackendUrl,
    withCredentials: true,
    timeout: 1000 * 30,
});

let isRefreshing = false;
let failedQueue: {
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
}[] = [];

let isLoggingOut = false
const forcedLogout = async () => {
    if (isLoggingOut) return;
    isLoggingOut = true;

    try {
        await logoutApi();
    } finally {
        removeAccessToken();
        clearTokens();
        window.location.href = "/login";
    }
};

const processQueue = (error: unknown) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(null);
    });
    failedQueue = [];
};

export function normalizeError(err: unknown): Error {
    if (err instanceof Error) return err;
    if (typeof err === 'string') return new Error(err);
    return new Error(JSON.stringify(err));
}

export const requestInterceptor = api.interceptors.request.use(
    async (config) => {
        config.withCredentials = true;

        if (config.headers?.skipAuth === 'true') {
            delete config.headers['skipAuth'];
            return config;
        }

        if (!config.method) throw Error('Not found config method');

        const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method.toUpperCase());
        const isCsrfFetchRequest = config.url === '/csrf-token';

        // attach CSRF token from memory
        if (isMutating && !isCsrfFetchRequest) {
            const csrfToken = await fetchOrGetCsrfToken(async () => {
                const res = await api.get('/csrf-token');
                return res.data.csrfToken;
            });

            if (!config.headers) config.headers = new axios.AxiosHeaders();
            else if (!(config.headers instanceof AxiosHeaders)) {
                config.headers = AxiosHeaders.from(config.headers);
            }

            config.headers.set('X-CSRF-TOKEN', csrfToken);;
        }

        const accessToken = getAccessToken();
        if (accessToken) {
            if (!config.headers) config.headers = new axios.AxiosHeaders();
            else if (!(config.headers instanceof AxiosHeaders)) {
                config.headers = AxiosHeaders.from(config.headers);
            }
            config.headers.set('Authorization', `Bearer ${accessToken}`);
        }

        return config;
    },
    (error) => Promise.reject(normalizeError(error))
);

interface CustomAxiosRequestConfig extends AxiosRequestConfig {
    _retry?: boolean;
}

export async function handleTokenRefresh(): Promise<{ accessToken: string }> {
    try {
        const response = await api.post('/auth/refresh', {}, {
            headers: { skipAuth: 'true' }
        });

        const { accessToken } = response.data;
        setAccessToken(accessToken);

        return { accessToken };
    } catch (err: unknown) {
        clearTokens();
        return Promise.reject(normalizeError(err));
    } finally {
        isRefreshing = false;
    }
}

function updateAuthHeader(request: CustomAxiosRequestConfig, token: string) {
    if (request.headers instanceof axios.AxiosHeaders) {
        request.headers.set('Authorization', `Bearer ${token}`);
    } else if (request.headers) {
        request.headers = {
            ...(request.headers as Record<string, string>),
            Authorization: `Bearer ${token}`,
        };
    } else {
        request.headers = new axios.AxiosHeaders({
            Authorization: `Bearer ${token}`
        });
    }
}

async function handleTokenRefresh401(originalRequest: CustomAxiosRequestConfig) {
    originalRequest._retry = true;

    if (isRefreshing) {
        return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
        });
    }

    isRefreshing = true;

    try {
        const { accessToken: newAccessToken } = await handleTokenRefresh();

        processQueue(null);
        updateAuthHeader(originalRequest, newAccessToken);
        return;
    } catch (refreshError) {
        processQueue(refreshError);
        await forcedLogout();
        return Promise.reject(normalizeError(refreshError));
    } finally {
        isRefreshing = false;
    }
}

api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as CustomAxiosRequestConfig;
        const status = error.response?.status;

        // handle CSRF error — clear token and retry once
        const isCsrfError = status === 403 && (error.response?.data as ApiErrorResponse)?.code === 'INVALID_CSRF_TOKEN';
        if (isCsrfError && !originalRequest._retry) {
            originalRequest._retry = true;
            clearCsrfToken();

            try {
                const newToken = await fetchOrGetCsrfToken(async () => {
                    const res = await api.get('/csrf-token');
                    return res.data.csrfToken;
                });

                if (!originalRequest.headers) originalRequest.headers = {};
                originalRequest.headers['X-CSRF-TOKEN'] = newToken;
                return api(originalRequest);
            } catch (err) {
                return Promise.reject(normalizeError(err));
            }
        }

        const isUnauthorized = status === 401;
        const isLoginRequest = originalRequest?.url?.includes('/auth/login');
        const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh');
        const hasSkipAuth = originalRequest?.headers?.skipAuth === 'true';
        const hasRetried = originalRequest?._retry === true;

        if (isLoginRequest) return Promise.reject(normalizeError(error));
        if (!isUnauthorized) return Promise.reject(normalizeError(error));
        if (hasSkipAuth) {
            await forcedLogout();
            return Promise.reject(normalizeError(error));
        }
        if (isRefreshRequest) {
            await forcedLogout();
            return Promise.reject(new Error('Session expired'));
        }
        if (hasRetried) {
            await forcedLogout();
            return Promise.reject(normalizeError(error));
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then(() => {
                return api(originalRequest);
            }).catch((err) => {
                return Promise.reject(err);
            });
        }

        originalRequest._retry = true;

        try {
            await handleTokenRefresh401(originalRequest);
            return api(originalRequest);
        } catch (refreshError) {
            await forcedLogout();
            return Promise.reject(refreshError);
        }
    }
);

// call this after login to pre-fetch CSRF token
export async function fetchCsrfToken(): Promise<void> {
    clearCsrfToken();
    await fetchOrGetCsrfToken(async () => {
        const res = await api.get('/csrf-token');
        return res.data.csrfToken;
    });
}
