'use client';

/**
 * TDS 스타일 스켈레톤 로딩 UI
 * - <style jsx> 미사용 (Next.js 14 호환)
 * - Math.random() 미사용 (하이드레이션 경고 방지)
 */
export default function LoadingSkeleton() {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#F9FAFB' }} aria-busy="true" aria-label="로딩 중">
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .sk {
          background: linear-gradient(90deg,#E5E8EB 25%,#F2F4F6 50%,#E5E8EB 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 6px;
        }
        @keyframes wooribounce {
          0%, 80%, 100% { transform: translateY(0); }
          40%            { transform: translateY(-6px); }
        }
        .dot1 { animation: wooribounce 1.2s 0.0s infinite; }
        .dot2 { animation: wooribounce 1.2s 0.15s infinite; }
        .dot3 { animation: wooribounce 1.2s 0.3s infinite; }
      `}</style>

      {/* 배너 스켈레톤 */}
      <div className="px-4 pt-4 pb-2">
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
          <div className="sk rounded-full" style={{ width: 44, height: 44, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="sk rounded-full mb-2" style={{ height: 12, width: 96 }} />
            <div className="sk rounded-full" style={{ height: 22, width: 72 }} />
          </div>
          <div className="sk rounded-full" style={{ height: 20, width: 56 }} />
        </div>
      </div>

      {/* 캘린더 헤더 */}
      <div className="px-4 pt-2 pb-3">
        <div className="flex items-center justify-between mb-5">
          <div className="sk rounded-xl" style={{ width: 36, height: 36 }} />
          <div className="sk rounded-full" style={{ height: 22, width: 110 }} />
          <div className="sk rounded-xl" style={{ width: 36, height: 36 }} />
        </div>

        {/* 요일 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 12 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="sk rounded-full mx-auto" style={{ height: 14, width: 18 }} />
          ))}
        </div>

        {/* 날짜 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', rowGap: 8 }}>
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
              <div
                className="sk rounded-full"
                style={{ width: 30, height: 30, opacity: (i % 3 === 0) ? 0.3 : 1 }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 로딩 점 */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
            <span className="dot1" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#9B8AA8' }} />
            <span className="dot2" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#9B8AA8' }} />
            <span className="dot3" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#9B8AA8' }} />
          </div>
          <p style={{ fontSize: 12, color: '#9EA7AD' }}>우리 사이를 불러오는 중...</p>
        </div>
      </div>
    </div>
  );
}
