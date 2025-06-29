import axios from "axios";

const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
console.log('Axios base URL is: ', baseUrl);

export const api = axios.create({
    baseURL: baseUrl,
    withCredentials: true,
});