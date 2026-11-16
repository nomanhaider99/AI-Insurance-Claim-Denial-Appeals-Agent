import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-muted/40 flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-xl font-semibold">AppealAI</p>
        {children}
        <p className="text-muted-foreground mt-6 text-center text-xs">
          Demo environment — synthetic data only.
        </p>
      </div>
    </main>
  );
}
