# Auth Full Parity Implementation Plan (Mobile = Web, UI Unchanged)

**Objective:** Align all mobile auth flows (login, signup, verify, forgot/reset password, forgot/reset pin) with the web’s Supabase-based implementation while **keeping the existing mobile UI** (screens, forms, navigation).

**Reference:** Web `apps/core/mbukanji-maps/src/contexts/AuthContext.tsx`, `ForgotPasswordModal.tsx`; Edge functions: `send-otp`, `verify-otp`, `reset-password-with-otp`.

---

## Why “Edge Function returned a non-2xx status code” (e.g. 404)?

The **mobile app only invokes** Edge Functions; it does not deploy them. The functions live in the **web app repo** and must be **deployed to your Supabase project**:

- **404** = the function (e.g. `send-otp`) is **not deployed** in the Supabase project your app uses, or the app’s `EXPO_PUBLIC_SUPABASE_URL` points to a different project.

**Fix:** Deploy the Edge Functions from the web app to the **same** Supabase project the mobile app uses:

```bash
cd apps/core/mbukanji-maps
supabase link   # if not already linked to the project matching EXPO_PUBLIC_SUPABASE_URL
supabase functions deploy send-otp
supabase functions deploy verify-otp
supabase functions deploy reset-password-with-otp
```

Ensure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in address-maker-glopams `.env` match that project (same as web’s `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`).

---

## Task overview

| # | Task | Status | Files |
|---|------|--------|-------|
| 1 | **Signup** — Supabase signUp + send-otp (email) or roles (phone) | Done | `(auth)/signup.tsx` |
| 2 | **Verify (signup)** — send-otp + verify-otp (email) / verifyOtp (phone) | Done | `phone-number-verification.tsx`, `email-verification.tsx` |
| 3 | **Forgot password** — resetPasswordForEmail or send-otp | Done | `(auth)/forgot-password.tsx` |
| 4 | **Reset password** — reset-password-with-otp | Done | `(auth)/reset-password.tsx`, `email-verification-reset-password.tsx` |
| 5 | **Forgot pin** — send-otp (phone, password_reset) | Done | `(auth)/forgot-pin.tsx` |
| 6 | **Reset pin** — reset-password-with-otp (phone lookup if supported) or same as reset password | Done | `(auth)/reset-pin.tsx`, `phone-number-verification-pin-reset.tsx` |

---

## Task 1 — Signup

**Current:** `useRegisterUser` → Laravel `POST /auth/register`.

**Target (same as web):**
- **Email:** `supabase.auth.signUp({ email, password, options: { data: { first_name, last_name, middle_names, profile_image } } })` then `supabase.functions.invoke('send-otp', { body: { identifier: email, purpose: 'signup', type: 'email' } })`. Set minimal user in context; navigate to verification.
- **Phone:** `supabase.auth.signUp({ phone, password, options: { data: { ... } } })`; optionally insert `user_roles` (and subscriptions) like web; navigate to verification or `(tabs)` if session exists.

**Acceptance:** No Laravel register call; same form and validation; success sets user and navigates to verification (or home for phone when session returned).

---

## Task 2 — Verify (signup OTP)

**Current:** `useResendVerificationCode` → Laravel `PUT /auth/code/resend`; `useConfirmVerificationCode` → Laravel `POST /auth/code/verify`.

**Target:**
- **Resend:** `supabase.functions.invoke('send-otp', { body: { identifier, purpose: 'signup', type: 'email' } })` (or phone as needed).
- **Confirm email:** `supabase.functions.invoke('verify-otp', { body: { identifier, code, purpose: 'signup', userId, tier } })` then getSession and set user/session.
- **Confirm phone:** `supabase.auth.verifyOtp({ type: 'sms', token: code, phone })`.

**Acceptance:** Same OTP UI; verification uses Supabase/edge only; after success set user, updateAuthHeader, syncRolesFromBackend, navigate.

---

## Task 3 — Forgot password

**Current:** `useForgotPassword` → Laravel `GET /auth/forgot/password`.

**Target:** Either `supabase.auth.resetPasswordForEmail(email, { redirectTo })` or `send-otp` with `purpose: 'password_reset'`, `type: 'email'`; set user (email) and navigate to “enter code + new password” screen.

**Acceptance:** Same screen; no Laravel; user can complete reset via link or OTP.

---

## Task 4 — Reset password

**Current:** `useResetPassword` → Laravel `POST /auth/reset/password` (user_id, code, new_password).

**Target:** `supabase.functions.invoke('reset-password-with-otp', { body: { email, code, newPassword } })`. Email from context (set on forgot step).

**Acceptance:** Same form; reset uses edge function; success navigate to login.

---

## Task 5 — Forgot pin

**Current:** `useForgotPinCode` → Laravel `GET /auth/forgot/pincode`.

**Target:** `send-otp` with `identifier: phone_number`, `purpose: 'password_reset'`, `type: 'phone'` (if supported). Set user (phone); navigate to pin reset verification.

**Acceptance:** Same screen; no Laravel; if edge function does not support phone for password_reset, document and optionally keep Laravel or add backend support later.

---

## Task 6 — Reset pin

**Current:** `useResetPinCode` → Laravel `POST /auth/reset/pincode`.

**Target:** Use same concept as reset password (Supabase user has one password; “pin” is that password). Call `reset-password-with-otp` with email if user has email, or a phone-capable edge function if available. Alternatively, invoke a dedicated reset-pin edge function that looks up by phone and updates password.

**Acceptance:** Same UI; pin reset updates Supabase Auth password; success navigate to login.

**Backend note:** Mobile calls `reset-password-with-otp` with `{ phone, code, newPassword }` for pin reset. The existing edge function only accepts `email`. To support forgot/reset pin, extend `reset-password-with-otp` to accept optional `phone`: when `phone` is provided, look up OTP by `identifier: phone` (same format as send-otp) and find user by `auth.users.phone`; then update password. Pin can be 5+ characters if the backend allows.

---

## Implementation status (mobile code)

| Item | Status | Notes |
|------|--------|--------|
| Supabase client + env | Done | `lib/supabase/client.ts`, `EXPO_PUBLIC_SUPABASE_*` in `.env` |
| Login (Supabase) | Done | `(auth)/login.tsx` — `signInWithPassword` |
| Session restore | Done | `_layout.tsx` — `getSession` + `onAuthStateChange` |
| Logout (Supabase) | Done | `utils/auth.ts` — `signOut()` |
| Roles from Supabase | Done | `lib/rolesSync.ts` — `user_roles`; sync after login/restore |
| Signup (Supabase + send-otp) | Done | `(auth)/signup.tsx` — invokes `send-otp` after signUp |
| Verify (send-otp + verify-otp/verifyOtp) | Done | `phone-number-verification.tsx`, `email-verification.tsx` |
| Forgot / Reset password | Done | `forgot-password.tsx`, `email-verification-reset-password.tsx`, `reset-password.tsx` |
| Forgot / Reset pin | Done | `forgot-pin.tsx`, `phone-number-verification-pin-reset.tsx`, `reset-pin.tsx` |
| **Edge Functions deployed** | **Your step** | Deploy `send-otp`, `verify-otp`, `reset-password-with-otp` from `mbukanji-maps` to the Supabase project used by the app (see “Why 404?” above). |

---

## Shared implementation notes

- **Supabase client:** `getSupabase()` from `lib/supabase/client.ts`; check for null when env missing.
- **Edge functions:** `getSupabase().functions.invoke('<name>', { body: { ... } })`.
- **Context after auth:** `mapSupabaseUser(session.user)`, `updateAuthHeader(session.access_token)`, `syncRolesFromBackend(session.user.id)`.
- **Persistence:** Store `pendingUserId` / `pendingUser` (e.g. signup type, identifier) in context or a small auth-state module when navigating to verification screens so resend/confirm have the right payload.
