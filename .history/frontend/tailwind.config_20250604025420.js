// /** @type {import('tailwindcss').Config} */

// module.exports = {
//     content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
//     theme: {
//         extend: {
//             colors: {
//                 danger: "#FF3632",
//                 dangerLight: "#FF8280",
//                 dangerLighter: "#FFB3B2",
//                 dangerWhite: "#FFE5E5",
//                  primary: "#1263F0",
//             },
//         },
//     },
//     plugins: [],
// }

/** @type {import('tailwindcss').Config} */

module.exports = {
    content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
    theme: {
        extend: {
            colors: {
                danger: {
                    DEFAULT: "#FF3632", // This allows `bg-danger` to work
                    light: "#FF8280",
                    lighter: "#FFB3B2",
                    white: "#FFE5E5",
                },
                primary: "#1263F0",
            },
        },
    },
    plugins: [],
};