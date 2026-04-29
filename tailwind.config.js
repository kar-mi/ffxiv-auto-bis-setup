/** @type {import('tailwindcss').Config} */
export default {
  content: ["src/ui/**/*.{ts,tsx}", "public/index.html"],
  theme: {
    extend: {
      colors: {
        ffxiv: {
          gold:   "#c8a84b",
          dark:   "#0d0d0d",
          panel:  "#1a1a2e",
          border: "#2e2e4a",
        },
      },
    },
  },
};
