import axios, { AxiosRequestConfig, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { setAccessToken, getRefreshToken, setRefreshToken, clearTokens } from "./token";
import Cookies from 'js-cookie';

const baseUrl = process.env.NEXT_PUBLIC_NGROK_BACKEND_URL;
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
    (error) => {
        return Promise.reject(error);
    }
);

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

api.interceptors.response.use(
    (response) => response, // On success, just pass the response through
    async (error: AxiosError) => {
        const originalRequest = error.config as CustomAxiosRequestConfig;

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            originalRequest._retry = true; // Mark this request as retried

            if (!isRefreshing) {
                isRefreshing = true; // Set flag to indicate refresh process is active
                const refreshToken = getRefreshToken();

                if (!refreshToken) {
                    clearTokens();
                    return Promise.reject(error);
                }

                try {
                    const refreshResponse: AxiosResponse = await axios.post('/auth/refresh', { refreshToken });
                    const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data;

                    setAccessToken(accessToken);
                    setRefreshToken(newRefreshToken);

                    isRefreshing = false;
                    processQueue(null, accessToken); // Process queued requests with the new access token

                    // Re-attempt the original failed request with the new access token
                    if (!originalRequest.headers) {
                        originalRequest.headers = new axios.AxiosHeaders();
                    } else if (!(originalRequest.headers instanceof axios.AxiosHeaders)) {
                        originalRequest.headers = axios.AxiosHeaders.from(originalRequest.headers);
                    }
                    originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
                    return api(originalRequest);

                } catch (refreshError: any) {
                    console.error('Failed to refresh token or token reuse detected:', refreshError);
                    clearTokens();
                    isRefreshing = false;
                    processQueue(refreshError); // Reject all queued requests
                    return Promise.reject(refreshError);
                }
            } else {
                // If a refresh is already in progress, queue the current failed request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject, config: originalRequest });
                });
            }
        }

        return Promise.reject(error);
    }
);

export async function fetchCsrfToken(): Promise<void> {
    try {
        await api.get('/csrf-token');
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
    }
}