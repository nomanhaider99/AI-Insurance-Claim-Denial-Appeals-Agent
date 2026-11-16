'use client';

import { useRef } from 'react';
import { createInviteSchema, roles, type Role, type UserDto } from '@appeal/shared';
import { can, useMe } from '@/hooks/use-me';
import {
  useCreateInvite,
  useInvites,
  useOrgUsers,
  useRevokeInvite,
  useUpdateRole,
} from '@/hooks/use-org';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Field, FormError, useZodForm } from '@/components/form';

const selectClass =
  'border-input h-9 rounded-md border bg-transparent px-2 text-sm focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none';

export default function UsersPage() {
  const { data: me, isPending } = useMe();
  if (isPending) return <p className="text-muted-foreground">Loading…</p>;
  if (!can(me, 'viewUsers')) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p role="alert">You don&apos;t have access to this page.</p>
      </div>
    );
  }
  const isAdmin = can(me, 'manageUsers');

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      <UsersTable canEdit={isAdmin} currentUserId={me!.user.id} />
      {can(me, 'manageInvites') && (
        <>
          <InviteForm />
          <PendingInvites />
        </>
      )}
    </div>
  );
}

function UsersTable({ canEdit, currentUserId }: { canEdit: boolean; currentUserId: string }) {
  const users = useOrgUsers();
  const update = useUpdateRole();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team members</CardTitle>
        <CardDescription>
          Admins manage users. Reviewers approve appeals. Billers upload denials and request drafts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {users.isPending && <p className="text-muted-foreground text-sm">Loading users…</p>}
        {users.isError && (
          <FormError>
            Couldn&apos;t load users.{' '}
            <button className="underline" onClick={() => users.refetch()}>
              Retry
            </button>
          </FormError>
        )}
        {update.error && <FormError>{(update.error as ApiError).message}</FormError>}
        {users.data && users.data.data.length === 0 && (
          <p className="text-muted-foreground text-sm">No users yet.</p>
        )}
        {users.data && users.data.data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left">
              <tr>
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Email</th>
                <th className="py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.data.data.map((u: UserDto) => (
                <tr key={u.id} className="border-t">
                  <td className="py-2">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="text-muted-foreground"> (you)</span>
                    )}
                  </td>
                  <td className="py-2">{u.email}</td>
                  <td className="py-2">
                    {canEdit ? (
                      <select
                        aria-label={`Role for ${u.name}`}
                        className={selectClass}
                        value={u.role}
                        disabled={update.isPending}
                        onChange={(e) => update.mutate({ id: u.id, role: e.target.value as Role })}
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="capitalize">{u.role}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function InviteForm() {
  const create = useCreateInvite();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useZodForm(createInviteSchema, async (data) => {
    await create.mutateAsync(data);
    formRef.current?.reset();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a teammate</CardTitle>
        <CardDescription>They&apos;ll get a link that works for 7 days.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          onSubmit={form.onSubmit}
          className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          noValidate
        >
          <Field name="email" label="Email" type="email" error={form.errors.email} />
          <div className="grid gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <select id="invite-role" name="role" defaultValue="biller" className={selectClass}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={form.pending}>
            {form.pending ? 'Sending…' : 'Send invite'}
          </Button>
        </form>
        <div className="mt-3">
          <FormError>{form.formError}</FormError>
          {create.isSuccess && !form.formError && (
            <p role="status" className="text-sm">
              Invite sent.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PendingInvites() {
  const invites = useInvites();
  const revoke = useRevokeInvite();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invites</CardTitle>
      </CardHeader>
      <CardContent>
        {invites.isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
        {invites.isError && <FormError>Couldn&apos;t load invites.</FormError>}
        {invites.data?.data.length === 0 && (
          <p className="text-muted-foreground text-sm">No pending invites.</p>
        )}
        <ul className="divide-y">
          {invites.data?.data.map((i) => (
            <li key={i.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {i.email} · <span className="capitalize">{i.role}</span> · expires{' '}
                {new Date(i.expiresAt).toLocaleDateString()}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(i.id)}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
