import { ReactNode } from 'react';

export function PageCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center px-3 sm:px-6 py-4 sm:py-8">
      <div className="w-full bg-card border border-line rounded-2xl shadow-[0_30px_60px_-34px_rgba(21,24,26,0.28)] overflow-hidden p-4 sm:p-6 flex flex-col gap-6">
        {children}
      </div>
    </div>
  );
}
