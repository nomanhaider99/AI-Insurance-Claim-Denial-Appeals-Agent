'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { loginSchema, meResponseSchema } from '@appeal/shared';
import { apiFetch } from '@/lib/api-client';
import { safeNext } from '@/lib/safe-next';
import { meQueryKey } from '@/hooks/use-me';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FormError, useZodForm } from '@/components/form';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const form = useZodForm(loginSchema, async (data) => {
    const me = await apiFetch('/api/v1/auth/login', meResponseSchema, {
      method: 'POST',
      body: data,
    });
    qc.setQueryData(meQueryKey, me);
    router.replace(safeNext(params.get('next')));
  });

  return (
    <form onSubmit={form.onSubmit} className="grid gap-4" noValidate>
      <FormError>{form.formError}</FormError>
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={form.errors.email}
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={form.errors.password}
      />
      <Button type="submit" disabled={form.pending}>
        {form.pending ? 'Signing in…' : 'Sign in'}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="underline-offset-4 hover:underline">
          Forgot password?
        </Link>
        <Link href="/register" className="underline-offset-4 hover:underline">
          Create an organization
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Sign in</h1>
        </CardTitle>
        <CardDescription>Use your work email and password.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
