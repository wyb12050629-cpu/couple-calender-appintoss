/**
 * 우리 사이 — Apps-in-Toss web-framework 빌드 설정
 * ─────────────────────────────────────────────────────
 * - Next.js를 정적 export 모드로 빌드 → out/ 디렉터리 → ait가 .ait 패키지로 묶음
 * - dev/build 명령은 Next.js 명령을 직접 호출 (granite/ait를 다시 부르지 않게 주의)
 * - 토스 콘솔에 등록된 appName: couple-calender (오타 그대로)
 * ─────────────────────────────────────────────────────
 */

import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 토스 앱 콘솔에 등록된 식별자 (변경 X)
  appName: 'couple-calender',

  brand: {
    displayName: '우리 사이',
    primaryColor: '#9B8AA8', // shared 톤 (커플 공유 색)
    icon: null,              // 아이콘 등록 후 URL 또는 public/ 경로 지정
  },

  web: {
    host: 'localhost',
    port: 3000, // Next.js dev 기본 포트
    commands: {
      dev:   'next dev',   // ← npm run dev (granite dev) 무한루프 방지: next 직접 호출
      build: 'next build', // 정적 export(next.config.mjs)와 함께 out/ 생성
    },
  },

  // 사용 권한 추가시 여기에 (예: 'location', 'camera' 등). v1은 비워둠.
  permissions: [],

  // Next.js `output: 'export'` 결과 디렉터리
  outdir: 'out',
});
