'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { acceptInviteSchema, meResponseSchema } from '@appeal/shared';
import { apiFetch } from '@/lib/api-client';
import { useUrlToken } from '@/hooks/use-url-token';
import { meQueryKey } from '@/hooks/use-me';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FormError, useZodForm } from '@/components/form';

function AcceptForm() {
  const token = useUrlToken();
  const router = useRouter();
  const qc = useQueryClient();
  const form = useZodForm(acceptInviteSchema, async (data) => {
    const me = await apiFetch('/api/v1/auth/invites/accept', meResponseSchema, {
      method: 'POST',
      body: data,
    });
    qc.setQueryData(meQueryKey, me);
    router.replace('/');
  });

  if (token === undefined) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (!token) return <FormError>This invite link is missing its token.</FormError>;
  return (
    <form onSubmit={form.onSubmit} className="grid gap-4" noValidate>
      <FormError>{form.formError}</FormError>
      <input type="hidden" name="token" value={token} />
      <Field name="name" label="Your name" autoComplete="name" error={form.errors.name} />
      <Field
        name="password"
        label="Password (12+ characters)"
        type="password"
        autoComplete="new-password"
        error={form.errors.password}
      />
      <Button type="submit" disabled={form.pending}>
        {form.pending ? 'Joining…' : 'Join organization'}
      </Button>
    </form>
  );
}

export default function AcceptInvitePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Join your team</h1>
        </CardTitle>
        <CardDescription>Set up your account to accept the invite.</CardDescription>
      </CardHeader>
      <CardContent>
        <AcceptForm />
      </CardContent>
    </Card>
  );
}
