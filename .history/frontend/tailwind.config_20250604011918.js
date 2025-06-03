/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        danger: {
          DEFAULT: '#FF3632',
          light: '#FF8280',
          lighter: '#FFB3B2',
          lightest: '#FFE5E5'
        }
      }
    },
  },
  plugins: [],
}
