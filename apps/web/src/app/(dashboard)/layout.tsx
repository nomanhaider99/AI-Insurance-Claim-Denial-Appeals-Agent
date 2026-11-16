import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { UserMenu } from '@/components/user-menu';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <span className="text-muted-foreground text-sm">
            Synthetic data only — demo environment
          </span>
          <UserMenu />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
