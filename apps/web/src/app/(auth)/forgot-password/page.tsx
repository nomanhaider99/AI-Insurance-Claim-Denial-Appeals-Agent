'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgotPasswordSchema, okResponseSchema } from '@appeal/shared';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FormError, useZodForm } from '@/components/form';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const form = useZodForm(forgotPasswordSchema, async (data) => {
    await apiFetch('/api/v1/auth/password/forgot', okResponseSchema, {
      method: 'POST',
      body: data,
    });
    setSent(true);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Reset your password</h1>
        </CardTitle>
        <CardDescription>We&apos;ll email you a link that works for 1 hour.</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p role="status" className="text-sm">
            If an account exists for that email, a reset link is on its way.
          </p>
        ) : (
          <form onSubmit={form.onSubmit} className="grid gap-4" noValidate>
            <FormError>{form.formError}</FormError>
            <Field
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              error={form.errors.email}
            />
            <Button type="submit" disabled={form.pending}>
              {form.pending ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}
        <p className="mt-4 text-sm">
          <Link href="/login" className="underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
