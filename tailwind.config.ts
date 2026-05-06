import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 기본 시스템
        background: "var(--tds-gray-10)",
        foreground:  "var(--tds-gray-900)",
        paper:       "#FFFFFF",
        ink:         "var(--tds-gray-900)",
        caption:     "var(--tds-gray-600)",
        line:        "var(--tds-gray-50)",
        // 우리 사이 포인트 컬러 (me = 내 일정, partner = 상대 일정, shared = 공유)
        me:          "#B85F5F",
        partner:     "#5F7B95",
        shared:      "#9B8AA8",
        accent:      "#D4A574",
        // TDS 토스 블루 (Tailwind에서 toss-blue 로 사용 가능)
        "toss-blue": "var(--tds-blue)",
        "toss-blue-50": "var(--tds-blue-50)",
      },
      fontFamily: {
        header: ["Pretendard", "sans-serif"],
        handwriting: ["Pretendard", "sans-serif"],
        body: ["Pretendard", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
