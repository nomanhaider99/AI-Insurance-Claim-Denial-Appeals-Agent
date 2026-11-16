'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Gavel, LayoutDashboard, Library, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/claims', label: 'Claims', icon: FileText },
  { href: '/appeals', label: 'Appeals', icon: Gavel },
  { href: '/policies', label: 'Policies', icon: Library },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="bg-muted/40 hidden w-56 shrink-0 border-r md:block">
      <div className="px-5 py-4 text-lg font-semibold">AppealAI</div>
      <nav aria-label="Main" className="flex flex-col gap-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                active && 'bg-accent font-medium',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
