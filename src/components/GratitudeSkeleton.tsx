'use client';

export default function GratitudeSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-md p-4 animate-pulse"
          style={{
            backgroundColor: i % 2 === 0 ? '#FCE8EC' : '#E5EDF5',
            transform: `rotate(${i % 2 === 0 ? -1 : 1}deg)`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-3 w-10 bg-line rounded" />
            <div className="h-3 w-16 bg-line rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full bg-line rounded" />
            <div className="h-3 w-3/4 bg-line rounded" />
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="h-2.5 w-14 bg-line rounded" />
            <div className="w-8 h-8 bg-line rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
