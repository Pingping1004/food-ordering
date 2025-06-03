/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
         danger: "#FF3632", // base danger color
    dangerLight: "#FF8280",
      dangerLighter: "#FFB3B2",
    dangerWhite: "#FFE5E5",
  primary: "#1263F0",
      },
    },
  },
  plugins: [],
};
