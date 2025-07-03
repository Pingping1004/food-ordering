import axios, { AxiosRequestConfig } from "axios";
import Cookies from 'js-cookie';

const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
console.log('Axios base URL is: ', baseUrl);

export const api = axios.create({
    baseURL: baseUrl,
    withCredentials: true,
});

api.interceptors.request.use(
    (config) => {
        const csrfToken = Cookies.get('XSRF-TOKEN');

        if (!config.method) throw Error('Not found config method');

        if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method.toUpperCase())) {
            if (!config.headers) {
                config.headers = new axios.AxiosHeaders();
            }
            config.headers['x-csrf-token'] = csrfToken;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export async function fetchCsrfToken(): Promise<void> {
    try {
        // Make a GET request to your new CSRF endpoint.
        // Your backend's CsrfController (`@Controller('csrf-token')`)
        // will generate the token and set the XSRF-TOKEN cookie.
        await api.get('/csrf-token');
        console.log('Successfully fetched new CSRF token and cookie should be set.');
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
        // Handle error appropriately, e.g., show a message to the user, retry, etc.
    }
}