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
      colors: {
        "danger-main": "#FF3632",
      },
    },
  },
};
