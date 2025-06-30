// tailwind.config.js
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#23415c',
        accent: '#41b4a2',
        text: '#233e5c',
        bg: '#f7fafc',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography')
  ]
}
