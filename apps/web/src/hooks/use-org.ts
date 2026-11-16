'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  inviteDtoSchema,
  paginatedSchema,
  userDtoSchema,
  type CreateInviteInput,
  type Role,
} from '@appeal/shared';
import { apiFetch } from '@/lib/api-client';

const usersKey = ['org', 'users'] as const;
const invitesKey = ['org', 'invites'] as const;

export function useOrgUsers(page = 1, enabled = true) {
  return useQuery({
    queryKey: [...usersKey, page],
    queryFn: () =>
      apiFetch(`/api/v1/org/users?page=${page}&pageSize=50`, paginatedSchema(userDtoSchema)),
    enabled,
  });
}

export function useInvites(enabled = true) {
  return useQuery({
    queryKey: invitesKey,
    queryFn: () => apiFetch('/api/v1/org/invites', z.object({ data: z.array(inviteDtoSchema) })),
    enabled,
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      apiFetch(`/api/v1/org/users/${id}/role`, userDtoSchema, { method: 'PATCH', body: { role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInviteInput) =>
      apiFetch('/api/v1/org/invites', inviteDtoSchema, { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitesKey }),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/org/invites/${id}`, z.undefined(), { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitesKey }),
  });
}
