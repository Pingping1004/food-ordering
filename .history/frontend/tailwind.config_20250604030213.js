/** @type {import('tailwindcss').Config} */

module.exports = {
    content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
    theme: {
        extend: {
            colors: {
                DEFAULT: ""
                'danger-main': "#FF3632",
                'dangerLight': "#FF8280",
               ' dangerLighter': "#FFB3B2",
                'dangerWhite': "#FFE5E5",
                'primary': "#1263F0",
            },
        },
    },
    plugins: [],
}