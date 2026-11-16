import { z } from 'zod';
import { roleSchema } from './domain.js';

export const emailSchema = z
  .email('Enter a valid email')
  .max(254)
  .transform((e) => e.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128, 'Use at most 128 characters');

const nameSchema = z.string().trim().min(1, 'Required').max(120);

export const registerSchema = z.object({
  orgName: nameSchema,
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Required').max(128),
});
export type LoginInput = z.input<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(1).max(200),
  name: nameSchema,
  password: passwordSchema,
});
export type AcceptInviteInput = z.input<typeof acceptInviteSchema>;

export const createInviteSchema = z.object({ email: emailSchema, role: roleSchema });
export type CreateInviteInput = z.input<typeof createInviteSchema>;

export const updateRoleSchema = z.object({ role: roleSchema });
export type UpdateRoleInput = z.input<typeof updateRoleSchema>;

export const idParamSchema = z.object({ id: z.uuid() });

export const userDtoSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
});
export type UserDto = z.infer<typeof userDtoSchema>;

export const organizationDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});
export type OrganizationDto = z.infer<typeof organizationDtoSchema>;

export const meResponseSchema = z.object({
  user: userDtoSchema,
  organization: organizationDtoSchema,
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const inviteDtoSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: roleSchema,
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type InviteDto = z.infer<typeof inviteDtoSchema>;

export const csrfResponseSchema = z.object({ csrfToken: z.string() });
export const okResponseSchema = z.object({ ok: z.literal(true) });

/** Which roles may do what. The API enforces this; the UI uses it only to hide actions. */
export const permissions = {
  viewUsers: ['admin', 'reviewer'],
  manageUsers: ['admin'],
  manageInvites: ['admin'],
} as const satisfies Record<string, readonly z.infer<typeof roleSchema>[]>;
export type Permission = keyof typeof permissions;
