import withPWA from 'next-pwa';

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Apps-in-Toss web-framework는 정적 SPA만 패키징하므로 next export 모드로 빌드
  output: 'export',
  // 정적 export는 Image Optimization 서버가 없으므로 비활성화
  images: { unoptimized: true },
  // SPA 라우팅 안정화 (디렉터리 기반 출력)
  trailingSlash: true,
};

export default pwaConfig(nextConfig);
