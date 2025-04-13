/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Primary color and variants
        primary: {
          DEFAULT: "#6AD1DB",
          dark: "#5Cc1CB",
          darker: "#4AA1AA",
        },
        // Background colors
        background: {
          DEFAULT: "#121212",
          card: "#1E1E1E",
          "card-alt": "#2A2A2A",
        },
        // Gray colors
        gray: {
          DEFAULT: "#333333",
          light: "#444444",
        },
        // White variations
        white: {
          DEFAULT: "#FFFFFF",
          off: "#AAAAAA",
          60: "rgba(255, 255, 255, 0.6)",
        },
      },
    },
  },
  plugins: [],
};
