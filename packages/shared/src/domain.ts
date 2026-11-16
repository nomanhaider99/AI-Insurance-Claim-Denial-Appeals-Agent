import { z } from 'zod';

export const roles = ['admin', 'reviewer', 'biller'] as const;
export const roleSchema = z.enum(roles);
export type Role = z.infer<typeof roleSchema>;

export const denialCategories = [
  'coding',
  'medical_necessity',
  'prior_auth',
  'eligibility',
  'duplicate',
  'timely_filing',
  'other',
] as const;
export const denialCategorySchema = z.enum(denialCategories);
export type DenialCategory = z.infer<typeof denialCategorySchema>;

export const claimStatuses = [
  'denied',
  'drafted',
  'in_review',
  'approved',
  'submitted',
  'won',
  'lost',
] as const;
export const claimStatusSchema = z.enum(claimStatuses);
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

export const appealStatuses = ['draft', 'in_review', 'approved', 'rejected', 'submitted'] as const;
export const appealStatusSchema = z.enum(appealStatuses);
export type AppealStatus = z.infer<typeof appealStatusSchema>;

export const documentKinds = ['denial_letter', 'eob', 'clinical_record', 'other'] as const;
export const documentKindSchema = z.enum(documentKinds);
export type DocumentKind = z.infer<typeof documentKindSchema>;
