---
name: frontend-ui
description: Conventions for the Next.js app in apps/web — App Router pages and layouts, components with shadcn/ui and Tailwind, data fetching with TanStack Query and the typed api-client, forms validated with Zod, loading/error/empty states, and accessibility basics. Use for any UI page, component or form.
---

# Frontend UI (apps/web)

## Structure

```
src/app/(dashboard)/<area>/page.tsx   Pages inside the authenticated shell (sidebar + header)
src/app/(auth)/login/page.tsx         Public pages (Phase 2)
src/components/ui/*                   shadcn/ui primitives (add with: pnpm dlx shadcn@latest add <name>, run in apps/web)
src/components/<feature>/*            Feature components (claims-table.tsx, appeal-editor.tsx)
src/lib/api-client.ts                 apiFetch(path, zodSchema, options): the only way to call the API
src/hooks/use-<thing>.ts              TanStack Query hooks per resource
```

## Rules

- **Server vs client:** pages are Server Components by default. Add `'use client'` only to components that need state, effects, or Query hooks. Keep client components small and leaf-level.
- **Data:** all API calls go through `apiFetch` with a Zod schema from `@appeal/shared`. Wrap them in hooks: `useClaims(params)` → `useQuery({ queryKey: ['claims', params], queryFn })`. Mutations use `useMutation` and invalidate the matching keys. Never call `fetch` directly in components.
- **Forms:** use the shared Zod schema for client validation (same schema as the API). Show field errors next to their fields and map API `VALIDATION_ERROR.details` back onto fields. Disable submit while pending. Every input has a `<label>`.
- **States:** every data view handles **loading** (skeleton or "Loading…"), **error** (message + retry, using `ApiError.message`), and **empty** (helpful text + primary action). Never show a blank screen.
- **AI content** is clearly labelled as an AI draft. Approval is an explicit human action with a confirmation. Uncertain fields (low confidence) are visually flagged.
- **Roles:** hide navigation and actions the user's role can't perform, but treat the API as the real enforcement.
- **Styling:** Tailwind utilities and shadcn tokens (`bg-background`, `text-muted-foreground`). Use `cn()` to merge classes. No inline styles. No new colour literals.
- **Accessibility:** semantic elements (`nav`, `main`, `button`, not clickable `div`s), `aria-current` on the active nav item, `aria-live` for async status, visible focus rings, sufficient contrast, keyboard-reachable dialogs (shadcn/Radix handle focus traps). Icons that carry meaning need text; decorative icons get `aria-hidden`.
- **No PHI in the browser beyond what the page needs.** Don't put claim data in URLs, localStorage or console logs.

## Checklist

- [ ] `'use client'` only where needed
- [ ] Data via `apiFetch` + Query hooks with Zod schemas
- [ ] Loading, error and empty states handled
- [ ] Forms: shared Zod schema, labelled inputs, server errors mapped to fields, pending state
- [ ] Keyboard and screen-reader basics checked
- [ ] Tests: hook/utility unit tests (Vitest); key flows covered by Playwright (see `testing`)
