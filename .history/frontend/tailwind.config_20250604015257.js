/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        danger: {
          DEFAULT: "#FF3632",
          'main': "#FF3632",
          'light': "#FF8280",
          'lighter': "#FFB3B2",
          '': "#FFE5E5",
        },
      },
    },
  },
  plugins: [],
};
