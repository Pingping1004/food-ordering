import axios, { AxiosRequestConfig, AxiosError, AxiosHeaders } from "axios";
import { setAccessToken, getRefreshToken, setRefreshToken, clearTokens, removeAccessToken } from "./token";
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

api.interceptors.request.use(
    (config) => {
        if (config.headers?.skipAuth === 'true') {
            return config;
        }

        const accessToken = localStorage.getItem('accessToken');
        if (accessToken && config.headers && !config.headers.Authorization) {
            if (!config.headers) {
                config.headers = new axios.AxiosHeaders();
            } else if (!(config.headers instanceof AxiosHeaders)) {
                config.headers = AxiosHeaders.from(config.headers);
            }
            config.headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const csrfToken = Cookies.get('XSRF-TOKEN');
        if (!config.method) throw Error('Not found config method');

        if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method.toUpperCase())) {
            if (!config.headers) {
                config.headers = new axios.AxiosHeaders();
            } else if (!(config.headers instanceof AxiosHeaders)) {
                config.headers = AxiosHeaders.from(config.headers);
            }

            const isCsrfFetchRequest = config.url === '/csrf-token';
            if (!isCsrfFetchRequest && !config.headers['X-CSRF-TOKEN']) {
                config.headers['X-CSRF-TOKEN'] = csrfToken;
            }
        }

        config.withCredentials = true;
        return config;
    },
    (error) => {
        if (error.response?.status === 401) {
            forcedLogout();
        }
        return Promise.reject(normalizeError(error))
    }
);

interface CustomAxiosRequestConfig extends AxiosRequestConfig {
    _retry?: boolean;
}

export async function handleTokenRefresh(originalRequest?: CustomAxiosRequestConfig): Promise<{ accessToken: string }> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        clearTokens();
        return Promise.reject(new Error("Missing refresh token"));
    }

    try {
        const response = await api.post('/auth/refresh', { refreshToken }, {
            headers: {
                skipAuth: 'true',
            }
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        setAccessToken(accessToken);
        setRefreshToken(newRefreshToken);

        return accessToken;
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

api.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
        const originalRequest = error.config as CustomAxiosRequestConfig;

        const isUnauthorized = error.response?.status === 401;
        const hasNotRetried = originalRequest && !originalRequest._retry;
        const isNotSkipAuth = originalRequest?.headers?.skipAuth !== 'true';

        if (!isUnauthorized || !hasNotRetried || !isNotSkipAuth) {
            if (isUnauthorized && !isNotSkipAuth) {
                forcedLogout();
            }
            return Promise.reject(normalizeError(error));
        }

        const criticalEndpoints = ['/user/profile', '/auth/refresh'];
        const isCriticalEndpointFailure = criticalEndpoints.some(endpoint =>
            originalRequest.url?.includes(endpoint)
        );

        if (isCriticalEndpointFailure) {
            forcedLogout();
            return Promise.reject(new Error('Session expired'));
        }

        originalRequest._retry = true;

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject, config: originalRequest });
            });
        }

        isRefreshing = true;

        try {
            const { accessToken: newAccessToken } = await handleTokenRefresh(originalRequest);
            processQueue(null, newAccessToken);

            if (originalRequest.headers instanceof axios.AxiosHeaders) {
                originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
            } else if (originalRequest.headers) {
                originalRequest.headers = {
                    ...(originalRequest.headers as Record<string,string>),
                    Authorization: `Bearer ${newAccessToken}`,
                };
            } else {
                originalRequest.headers = new axios.AxiosHeaders({ Authorization: `Bearer ${newAccessToken}` });
            }

            return api(originalRequest);
        } catch (error) {
            processQueue(error as AxiosError, null);
            forcedLogout();
            return Promise.reject(normalizeError(error));
        } finally {
            isRefreshing = false;
        }
    }
);

export async function fetchCsrfToken(): Promise<void> {
    await api.get('/csrf-token');
}