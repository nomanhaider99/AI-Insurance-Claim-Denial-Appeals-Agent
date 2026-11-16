'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import type { z } from 'zod';
import { ApiError, fieldErrorsOf } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Errors = Record<string, string>;

/**
 * Minimal form state for Zod-validated forms: client-side validation with the shared
 * schema, then server VALIDATION_ERROR details mapped back onto fields.
 */
export function useZodForm<S extends z.ZodType>(
  schema: S,
  onValid: (data: z.infer<S>) => Promise<void>,
) {
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await onValid(parsed.data);
    } catch (err) {
      const fields = fieldErrorsOf(err);
      setErrors(fields);
      if (Object.keys(fields).length === 0) {
        setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      }
    } finally {
      setPending(false);
    }
  }

  return { errors, formError, pending, onSubmit, setFormError };
}

export function Field({
  name,
  label,
  error,
  type = 'text',
  autoComplete,
  defaultValue,
}: {
  name: string;
  label: string;
  error?: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
}) {
  const errorId = `${name}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="text-destructive border-destructive/30 rounded-md border px-3 py-2 text-sm"
    >
      {children}
    </p>
  );
}
