'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Gavel, LayoutDashboard, Library, Users, type LucideIcon } from 'lucide-react';
import type { Permission } from '@appeal/shared';
import { can, useMe } from '@/hooks/use-me';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; icon: LucideIcon; permission?: Permission };

const nav: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/claims', label: 'Claims', icon: FileText },
  { href: '/appeals', label: 'Appeals', icon: Gavel },
  { href: '/policies', label: 'Policies', icon: Library },
  { href: '/settings/users', label: 'Users', icon: Users, permission: 'viewUsers' },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: me } = useMe();
  // Hide items the role can't use. The API still enforces every permission.
  const items = nav.filter((i) => !i.permission || can(me, i.permission));

  return (
    <aside className="bg-muted/40 hidden w-56 shrink-0 border-r md:block">
      <div className="px-5 py-4 text-lg font-semibold">AppealAI</div>
      <nav aria-label="Main" className="flex flex-col gap-1 px-3">
        {items.map(({ href, label, icon: Icon }) => {
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
