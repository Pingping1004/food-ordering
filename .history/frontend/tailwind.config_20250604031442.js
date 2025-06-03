/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/tw-elements/dist/js/**/*.js",
  ],
  plugins: [require("tw-elements")],
  darkMode: "class",
  theme: {
    
    extend: {
        DEFAULT: "#FF3632",
        'danger-main': "#FF3632",
        'dangerLight': "#FF8280",
        dangerLighter: "#FFB3B2",
        dangerWhite: "#FFE5E5",
        primary: "#1263F0",
    },
  },
};
