import axios, { AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig } from "axios";
import { setAccessToken, getRefreshToken, setRefreshToken, clearTokens } from "./token";
import Cookies from 'js-cookie';

// const baseUrl = `${process.env.NEXT_PUBLIC_NGROK_BACKEND_URL}/api`;
const baseUrl = '/api';
console.log('Axios base URL is: ', baseUrl);

export const api = axios.create({
    baseURL: baseUrl,
    withCredentials: true,
});

let isRefreshing = false;
let failedQueue: { resolve: (value?: any) => void; reject: (reason?: any) => void; config: AxiosRequestConfig }[] = [];

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
        console.log('CSRF Token from cookies:', csrfToken);
        if (!config.method) throw Error('Not found config method');

        if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method.toUpperCase())) {
            if (!config.headers) {
                config.headers = new axios.AxiosHeaders();
            }

            config.headers['X-CSRF-Token'] = csrfToken;
            config.headers['x-csrf-token'] = csrfToken;
        }

        return config;
    },
    (error: any) => {
        return Promise.reject(error instanceof Error ? error : new Error(JSON.stringify(error)))
    }
);

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

async function handleTokenRefresh(originalRequest: CustomAxiosRequestConfig): Promise<any> {
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
  } catch (err: any) {
    clearTokens();
    processQueue(err);
    return Promise.reject(err instanceof Error ? err : new Error(JSON.stringify(err)));
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
    try {
        await api.get('/csrf-token');
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
    }
}