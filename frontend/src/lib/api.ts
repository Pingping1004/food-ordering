import axios, { AxiosRequestConfig, AxiosError, AxiosHeaders } from "axios";
import { setAccessToken, clearTokens, removeAccessToken, clearCsrfToken, fetchOrGetCsrfToken } from "./token";

type ApiErrorResponse = {
    message?: string;
    code?: string;
};

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
    removeAccessToken();
    clearTokens();
    window.location.href = "/login";
};

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
        if (config.headers?.skipAuth === 'true') {
            delete config.headers['skipAuth'];
            return config;
        }

        // attach access token
        // const accessToken = localStorage.getItem('accessToken');
        // if (accessToken && config.headers && !config.headers.Authorization) {
        //     if (!config.headers) {
        //         config.headers = new axios.AxiosHeaders();
        //     } else if (!(config.headers instanceof AxiosHeaders)) {
        //         config.headers = AxiosHeaders.from(config.headers);
        //     }
        //     config.headers['Authorization'] = `Bearer ${accessToken}`;
        // }

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

        config.withCredentials = true;
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
            failedQueue.push({ resolve, reject, config: originalRequest });
        });
    }

    isRefreshing = true;

    try {
        const { accessToken: newAccessToken } = await handleTokenRefresh();

        processQueue(null, newAccessToken);
        updateAuthHeader(originalRequest, newAccessToken);

        if (!originalRequest.headers) originalRequest.headers = {};
        originalRequest.headers['skipAuth'] = 'true';

        return api(originalRequest);
    } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        forcedLogout();
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
            clearCsrfToken(); // force re-fetch on next interceptor call

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
            forcedLogout();
            return Promise.reject(normalizeError(error));
        }
        if (isRefreshRequest) {
            forcedLogout();
            return Promise.reject(new Error('Session expired'));
        }
        if (hasRetried) {
            forcedLogout();
            return Promise.reject(normalizeError(error));
        }

        return handleTokenRefresh401(originalRequest);
    }
);

// call this after login to pre-fetch CSRF token
export async function fetchCsrfToken(): Promise<void> {
    clearCsrfToken(); // force fresh token
    await fetchOrGetCsrfToken(async () => {
        const res = await api.get('/csrf-token');
        return res.data.csrfToken;
    });
}