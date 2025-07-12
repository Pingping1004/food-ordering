import Cookies from 'js-cookie';

export const getAccessToken = (): string | null => {
    const accessToken = Cookies.get('access_token');
    if (!accessToken) {
        return null;
    }
    return accessToken;
};

export const setAccessToken = (token: string): void => {
    if (!token) return;

    Cookies.set('access_token', token, {
        secure: true,
        sameSite: 'Lax',
        expires: new Date(Date.now() + 60 * 30 * 1000),
    });
}

export const getRefreshToken = (): string | null => {
    const refreshToken = Cookies.get('refresh_token');
    if (!refreshToken) {
        return null;
    }

    return refreshToken;
}

export const getCsrfToken = (): string | null => {
    console.log('Cookie from getCsrfToken: ', Cookies.get('XSRF-TOKEN'));
    return Cookies.get('XSRF-TOKEN') || null;
}

export const setCsrfToken = (token: string): void => {
    if (!token) return

    Cookies.set('XSRF-TOKEN', token, {
        secure: true,
        sameSite: 'None',
        path: '/',
    });
}

export const setRefreshToken = (token: string): void => {
    if (!token) return;
    Cookies.set('refresh_token', token);
}

export const removeAccessToken = (): void => {
    Cookies.remove('access_token');
}

export const removeRefreshToken = (): void => {
    Cookies.remove('refresh_token');
}

export const removeCsrfToken = (): void => {
    Cookies.remove('XSRF-TOKEN');
}

export const clearTokens = (): void => {
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    Cookies.remove('XSRF-TOKEN');
}