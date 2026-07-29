import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "var(--navy)",
        gold: "var(--gold)",
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        like: "var(--like)",
        repost: "var(--repost)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        glass: "34px",
        feed: "26px",
        fast: "24px",
        btn: "23px",
        field: "19px",
        media: "18px",
        nav: "28px",
      },
      maxWidth: {
        shell: "520px",
        feed: "680px",
        desk: "1280px",
      },
      boxShadow: {
        glass: "0 22px 45px rgba(7, 19, 35, 0.14)",
        soft: "0 10px 28px rgba(7, 19, 35, 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
