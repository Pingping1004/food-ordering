import Cookies from 'js-cookie';

let csrfTokenMemory: string | null = null;
let csrfFetchPromise: Promise<string> | null = null;

export const getAccessToken = (): string | null => {
    return localStorage.getItem('accessToken');
};

export const setAccessToken = (token: string | undefined): void => {
    if (token) {
        localStorage.setItem('accessToken', token);
    } else {
        localStorage.removeItem('accessToken')
    }
};

export const removeAccessToken = (): void => {
    localStorage.removeItem('accessToken');
};

export const getRefreshToken = (): string | null => {
    return Cookies.get('refresh_token') || null;
};

export const setRefreshToken = (token: string): void => {
    if (!token) return;
    Cookies.set('refresh_token', token);
};

export const removeRefreshToken = (): void => {
    Cookies.remove('refresh_token');
};

export const getCsrfToken = (): string | null => {
    return csrfTokenMemory;
};

export const setCsrfToken = (token: string): void => {
    csrfTokenMemory = token;
};

export const clearCsrfToken = (): void => {
    csrfTokenMemory = null;
    csrfFetchPromise = null;
};

export const fetchOrGetCsrfToken = (
    fetcher: () => Promise<string>
): Promise<string> => {
    if (csrfTokenMemory) return Promise.resolve(csrfTokenMemory);

    if (csrfFetchPromise) return csrfFetchPromise;

    csrfFetchPromise = fetcher()
        .then(token => {
            csrfTokenMemory = token;
            csrfFetchPromise = null;
            return token;
        })
        .catch(err => {
            csrfFetchPromise = null;
            throw err;
        });

    return csrfFetchPromise;
};

export const clearTokens = (): void => {
    localStorage.removeItem('accessToken');
    Cookies.remove('refresh_token');
    Cookies.remove('XSRF-TOKEN');
    clearCsrfToken();
};