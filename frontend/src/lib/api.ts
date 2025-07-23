import axios, { AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig, AxiosResponse, AxiosHeaders } from "axios";
import { setAccessToken, getRefreshToken, setRefreshToken, clearTokens } from "./token";
import Cookies from 'js-cookie';

const baseBackendUrl = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api`;
// const baseUrl = '/api';

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

// Function to process the queue of failed requests
const processQueue = (error: AxiosError | null, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else if (token) {
            if (!prom.config.headers) {
                prom.config.headers = new axios.AxiosHeaders();
            } else if (!(prom.config.headers instanceof axios.AxiosHeaders)) {
                prom.config.headers = axios.AxiosHeaders.from({ ...(prom.config.headers as object) });
            }
            prom.config.headers['Authorization'] = `Bearer ${token}`;
            prom.resolve(api(prom.config)); // Re-send the original request
        }
    });
    failedQueue = [];
};

api.interceptors.request.use(
    (config) => {
        const csrfToken = Cookies.get('XSRF-TOKEN');
        if (!config.method) throw Error('Not found config method');

        if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method.toUpperCase())) {
            if (!config.headers) {
                config.headers = new axios.AxiosHeaders();
            } else if (!(config.headers instanceof AxiosHeaders)) {
                config.headers = AxiosHeaders.from(config.headers);
            }

            config.headers['X-CSRF-Token'] = csrfToken;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error instanceof Error ? error : new Error(JSON.stringify(error)))
    }
);

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

async function handleTokenRefresh(originalRequest: CustomAxiosRequestConfig): Promise<AxiosResponse> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        clearTokens();
        return Promise.reject(new Error("Missing refresh token"));
    }

    try {
        const response = await axios.post('/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;

        setAccessToken(accessToken);
        setRefreshToken(newRefreshToken);
        processQueue(null, accessToken);

        if (!originalRequest.headers) {
            originalRequest.headers = new axios.AxiosHeaders();
        } else if (!(originalRequest.headers instanceof axios.AxiosHeaders)) {
            originalRequest.headers = axios.AxiosHeaders.from(originalRequest.headers);
        }

        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return api(originalRequest);
    } catch (err: unknown) {
        clearTokens();

        if (err && typeof err === 'object' && (err as AxiosError).isAxiosError) {
            processQueue(err as AxiosError); // safe cast
        } else {
            processQueue(null);
        }

        let rejectionError;

        if (err instanceof Error) {
            rejectionError = err;
        } else if (typeof err === 'string') {
            rejectionError = new Error(err);
        } else {
            // A fallback for other error types, like plain objects
            rejectionError = new Error(JSON.stringify(err));
        }

        return Promise.reject(rejectionError);
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

        if (!isUnauthorized || !hasNotRetried) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject, config: originalRequest });
            });
        }

        isRefreshing = true;
        return handleTokenRefresh(originalRequest);
    }
);

export async function fetchCsrfToken(): Promise<void> {
    await api.get('/csrf-token');
}