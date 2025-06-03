/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  safelist: [
    'bg-danger',
    'bg-danger-light',
    'bg-danger-lighter',
    'bg-danger-lightest'
  ],
  theme: {
    extend: {
      colors: {
        danger: '#FF3632',
        'danger-light': '#FF8280',
        'danger-lighter': '#FFB3B2',
        'danger-lightest': '#FFE5E5',
      },
    },
  },
  plugins: [],
};
