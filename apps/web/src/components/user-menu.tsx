'use client';

import { LogOut } from 'lucide-react';
import { useLogout, useMe } from '@/hooks/use-me';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function UserMenu() {
  const { data: me, isPending } = useMe();
  const logout = useLogout();
  if (isPending) return <span className="text-muted-foreground text-sm">Loading…</span>;
  if (!me) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="text-right text-sm leading-tight">
        <div className="font-medium">{me.user.name}</div>
        <div className="text-muted-foreground">{me.organization.name}</div>
      </div>
      <Badge variant="secondary" className="capitalize">
        {me.user.role}
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        aria-label="Sign out"
      >
        <LogOut aria-hidden />
        Sign out
      </Button>
    </div>
  );
}
