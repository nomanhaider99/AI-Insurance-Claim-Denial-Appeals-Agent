'use client';

import { useQuery } from '@tanstack/react-query';
import { readinessResponseSchema } from '@appeal/shared';
import { apiFetch } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ApiStatusCard() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: () => apiFetch('/health/ready', readinessResponseSchema),
    refetchInterval: 15_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>System status</CardTitle>
        <CardDescription>API and its dependencies</CardDescription>
      </CardHeader>
      <CardContent aria-live="polite">
        {isPending && <span className="text-muted-foreground text-sm">Checking…</span>}
        {isError && <Badge variant="destructive">API unreachable</Badge>}
        {data && (
          <ul className="flex flex-wrap gap-2">
            {Object.entries(data.checks).map(([name, status]) => (
              <li key={name}>
                <Badge variant={status === 'ok' ? 'secondary' : 'destructive'}>
                  {name}: {status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
