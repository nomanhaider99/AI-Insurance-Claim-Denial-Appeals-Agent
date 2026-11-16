'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { okResponseSchema, resetPasswordSchema } from '@appeal/shared';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FormError, useZodForm } from '@/components/form';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const form = useZodForm(resetPasswordSchema, async (data) => {
    await apiFetch('/api/v1/auth/password/reset', okResponseSchema, { method: 'POST', body: data });
    setDone(true);
  });

  if (!token) return <FormError>This reset link is missing its token.</FormError>;
  if (done) {
    return (
      <p role="status" className="text-sm">
        Password updated. You&apos;ve been signed out everywhere.{' '}
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </p>
    );
  }
  return (
    <form onSubmit={form.onSubmit} className="grid gap-4" noValidate>
      <FormError>{form.formError}</FormError>
      <input type="hidden" name="token" value={token} />
      <Field
        name="password"
        label="New password (12+ characters)"
        type="password"
        autoComplete="new-password"
        error={form.errors.password}
      />
      <Button type="submit" disabled={form.pending}>
        {form.pending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Choose a new password</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Suspense>
          <ResetForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
