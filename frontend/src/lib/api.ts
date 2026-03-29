import axios, { AxiosRequestConfig, AxiosError, AxiosHeaders } from "axios";
import { setAccessToken, clearTokens, removeAccessToken, getCsrfToken } from "./token";
import Cookies from 'js-cookie';

const baseBackendUrl = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api`;

export const api = axios.create({
    baseURL: baseBackendUrl,
    withCredentials: true,
});

let isRefreshing = false;
let failedQueue: {
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
    config: AxiosRequestConfig;
}[] = [];

const forcedLogout = () => {
    // localStorage.removeItem('accessToken');
    removeAccessToken();
    clearTokens();
    window.location.href = "/login";
}

// Function to process the queue of failed requests
const processQueue = (error: AxiosError | null, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject, config }) => {
        if (error) {
            reject(error);
        } else if (token) {
            if (!config.headers) {
                config.headers = new axios.AxiosHeaders();
            } else if (!(config.headers instanceof axios.AxiosHeaders)) {
                config.headers = axios.AxiosHeaders.from({ ...(config.headers as object) });
            }
            config.headers['Authorization'] = `Bearer ${token}`;
            resolve(api(config));
        }
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
        if (!config.method) throw Error('Not found config method');

        const method = config.method.toUpperCase();
        const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
        const isCsrfFetchRequest = config.url === '/csrf-token';

        if (isMutating && !isCsrfFetchRequest) {
            let csrfToken = Cookies.get('XSRF-TOKEN');

            if (!csrfToken) {
                await api.get('/csrf-token');
                csrfToken = Cookies.get('XSRF-TOKEN');
            }

            if (csrfToken) {
                if (!config.headers) config.headers = new AxiosHeaders();
                else if (!(config.headers instanceof AxiosHeaders)) {
                    config.headers = AxiosHeaders.from(config.headers);
                }

                config.headers.set('X-CSRF-TOKEN', csrfToken);
            }
        }

        config.withCredentials = true;
        return config;
    },
    (error) => {
        return Promise.reject(normalizeError(error))
    }
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

        let error: Error;

        if (err instanceof Error) error = err;
        else if (typeof err === 'string') error = new Error(err);
        else error = new Error(JSON.stringify(err));

        return Promise.reject(normalizeError(error));
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
            failedQueue.push({ resolve, reject, config: originalRequest });
        });
    }

    isRefreshing = true;

    try {
        // Attempt token refresh
        const { accessToken: newAccessToken } = await handleTokenRefresh();

        // Process queued requests
        processQueue(null, newAccessToken);

        // Update request headers with new token
        updateAuthHeader(originalRequest, newAccessToken);

        // Tell request interceptor to skip overwriting the header
        if (!originalRequest.headers) originalRequest.headers = {};
        originalRequest.headers['skipAuth'] = 'true';

        // Retry the original request
        return api(originalRequest);

    } catch (refreshError) {
        // Refresh failed - logout and reject all queued requests
        processQueue(refreshError as AxiosError, null);
        forcedLogout();
        return Promise.reject(normalizeError(refreshError));

    } finally {
        isRefreshing = false;
    }
}

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as CustomAxiosRequestConfig;
        const status = error.response?.status;

        const isCsrfError =
            status === 403 &&
            (error.response?.data as any)?.code === 'INVALID_CSRF_TOKEN';

        if (isCsrfError && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                await fetchCsrfToken();

                return api(originalRequest); // retry request
            } catch (err) {
                return Promise.reject(normalizeError(err));
            }
        }

        const isUnauthorized = status === 401;
        const isLoginRequest = originalRequest?.url?.includes('/auth/login');
        const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh');
        const hasSkipAuth = originalRequest?.headers?.skipAuth === 'true';
        const hasRetried = originalRequest?._retry === true;

        if (isLoginRequest) {
            return Promise.reject(normalizeError(error));
        }

        if (!isUnauthorized) {
            return Promise.reject(normalizeError(error));
        }

        if (hasSkipAuth) {
            forcedLogout();
            return Promise.reject(normalizeError(error));
        }

        if (isRefreshRequest) {
            forcedLogout();
            return Promise.reject(new Error('Session expired'));
        }

        // Already retried: avoid infinite loops
        if (hasRetried) {
            forcedLogout();
            return Promise.reject(normalizeError(error));
        }

        return handleTokenRefresh401(originalRequest);
    }
);

export async function fetchCsrfToken(): Promise<void> {
    const res = await api.get('/csrf-token');
    console.log("CSRF token: ", res.data)
}