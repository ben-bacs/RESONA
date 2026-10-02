/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#090A0F",
        surface: "#12141F",
        "surface-elevated": "#1A1D2E",
        primary: "#6366F1",
        "primary-hover": "#4F46E5",
        accent: "#06B6D4",
        muted: "#94A3B8",
      },
      fontFamily: {
        sans: ["Segoe UI", "-apple-system", "BlinkMacSystemFont", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
}
