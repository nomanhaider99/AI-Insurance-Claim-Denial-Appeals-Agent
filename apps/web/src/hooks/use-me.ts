'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meResponseSchema, permissions, type MeResponse, type Permission } from '@appeal/shared';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';

export const meQueryKey = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => apiFetch('/api/v1/auth/me', meResponseSchema),
    staleTime: 5 * 60_000,
  });
}

/** UI-only check for hiding actions. The API is the real enforcement. */
export function can(me: MeResponse | undefined, permission: Permission): boolean {
  return !!me && (permissions[permission] as readonly string[]).includes(me.user.role);
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/api/v1/auth/logout', z.undefined(), { method: 'POST' }),
    onSettled: () => {
      qc.clear();
      // Full reload on purpose: drops all cached client state for the old session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    },
  });
}
