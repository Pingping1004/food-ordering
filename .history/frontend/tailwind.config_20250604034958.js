/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/tw-elements/dist/js/**/*.js",
  ],
  plugins: [require("tw-elements")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        danger: {
          DEFAULT: "#dc2626",
          light: "#fca5a5",
          dark: "#b91c1c",
        }
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'], // Add Poppins font
      },
    },
  },
};
