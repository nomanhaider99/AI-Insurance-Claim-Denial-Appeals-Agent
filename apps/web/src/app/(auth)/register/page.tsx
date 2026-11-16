'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { meResponseSchema, registerSchema } from '@appeal/shared';
import { apiFetch } from '@/lib/api-client';
import { meQueryKey } from '@/hooks/use-me';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FormError, useZodForm } from '@/components/form';

export default function RegisterPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const form = useZodForm(registerSchema, async (data) => {
    const me = await apiFetch('/api/v1/auth/register', meResponseSchema, {
      method: 'POST',
      body: data,
    });
    qc.setQueryData(meQueryKey, me);
    router.replace('/');
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Create your organization</h1>
        </CardTitle>
        <CardDescription>You&apos;ll be its first admin and can invite your team.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.onSubmit} className="grid gap-4" noValidate>
          <FormError>{form.formError}</FormError>
          <Field name="orgName" label="Organization name" error={form.errors.orgName} />
          <Field name="name" label="Your name" autoComplete="name" error={form.errors.name} />
          <Field
            name="email"
            label="Work email"
            type="email"
            autoComplete="email"
            error={form.errors.email}
          />
          <Field
            name="password"
            label="Password (12+ characters)"
            type="password"
            autoComplete="new-password"
            error={form.errors.password}
          />
          <Button type="submit" disabled={form.pending}>
            {form.pending ? 'Creating…' : 'Create organization'}
          </Button>
          <p className="text-sm">
            Already have an account?{' '}
            <Link href="/login" className="underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
