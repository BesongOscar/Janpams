# Auth Supabase parity — checklist (mobile app)

This checklist is for the **mobile app** (`apps/core/address-maker-glopams`). Use it to ensure mobile auth works with Supabase (same auth as the web app, but configured here in the mobile project).

---

## 1. Environment (mobile)

- [ ] **`.env`** in **address-maker-glopams** has `EXPO_PUBLIC_SUPABASE_URL` and one of: `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- [ ] **Self-hosted:** Use your self-hosted Supabase API URL and anon/publishable key (same instance the web app uses).
- [ ] **Supabase Cloud:** Use the same URL and key as the web app’s `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`. Optional: `EXPO_PUBLIC_SUPABASE_PROJECT_ID` for cloud project ref.

---

## 2. Deploy Edge Functions (required for signup / verify / forgot-reset)

Without this, signup and related flows return **404** (“Edge Function returned a non-2xx status code”).

### Self-hosted Supabase (your case)

**Do not use `supabase login`** — that is for Supabase Cloud only and opens an online link. It is not used for self-hosted.

Your **mobile** `.env` (in address-maker-glopams) should have `EXPO_PUBLIC_SUPABASE_URL` and either `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` pointing to your self-hosted instance. You need to run the three auth Edge Functions **on your self-hosted stack**:

1. **Where the functions live in the repo:**  
   `apps/core/mbukanji-maps/supabase/functions/`  
   - `send-otp/`  
   - `verify-otp/`  
   - `reset-password-with-otp/`

2. **How to run them:** Use the [Supabase Edge Runtime](https://supabase.com/docs/reference/self-hosting-functions/introduction) (Docker or `run.sh`) so they are served at `{your-supabase-url}/functions/v1/<function-name>`.

3. **Details:** See **DEPLOY_SUPABASE_EDGE_FUNCTIONS.md** (self-hosted section: copy functions into your runtime, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and SMTP for send-otp).

- [ ] **send-otp** deployed and reachable at your self-hosted URL.
- [ ] **verify-otp** deployed and reachable.
- [ ] **reset-password-with-otp** deployed and reachable.

### Supabase Cloud only (if you were on cloud)

If you were using Supabase Cloud (not self-hosted), you would run:

```bash
supabase login
cd apps/core/mbukanji-maps
npx supabase link --project-ref vzdambpwxcxzzhtkvqnk
npm run deploy:auth-functions
```

**Skip this** when using a self-hosted URL and anon key in `.env`.

---

## 3. Mobile app code (already implemented)

| Flow | Implementation | File(s) |
|------|----------------|--------|
| **Login** | Supabase `signInWithPassword` (email or phone) | `app/(auth)/login.tsx` |
| **Session restore** | `getSession()` + `onAuthStateChange` in _layout | `app/_layout.tsx`, `app/index.tsx` |
| **Logout** | `supabase.auth.signOut()` | `utils/auth.ts` |
| **Signup (email)** | `signUp` then `send-otp` (signup, email) | `app/(auth)/signup.tsx` |
| **Signup (phone)** | `signUp` + `user_roles` insert | `app/(auth)/signup.tsx` |
| **Verify (signup)** | `send-otp` resend; `verify-otp` (email) or `verifyOtp` (phone) | `phone-number-verification.tsx`, `email-verification.tsx` |
| **Forgot password** | `send-otp` (password_reset, email) | `forgot-password.tsx` |
| **Reset password** | `reset-password-with-otp` (email, code, newPassword) | `reset-password.tsx`, `email-verification-reset-password.tsx` |
| **Forgot pin** | `send-otp` (password_reset, phone) | `forgot-pin.tsx` |
| **Reset pin** | `reset-password-with-otp` (phone, code, newPassword) | `reset-pin.tsx`, `phone-number-verification-pin-reset.tsx` |
| **Roles** | Supabase `user_roles` + SQLite cache | `lib/rolesSync.ts` |
| **API token** | Supabase session in `Authorization` header | `utils/interceptor.ts` |

---

## 4. Env and “Signup not configured” / “Login not configured”

If you see **“Supabase not configured”** or **“Set Supabase env”**:

1. **.env** in `apps/core/address-maker-glopams/` (the mobile app root) must have:
   - `EXPO_PUBLIC_SUPABASE_URL` = your Supabase API URL (e.g. `https://supabase-staging.janpams.com`)
   - Either `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = your anon/publishable key (both names work).
2. **Restart the dev server** after changing .env (Metro inlines env at start): stop `npx expo start` and run it again.
3. Rebuild the app if you use a dev build; for Expo Go, restarting the server is enough.

You can test that env is loaded: open the app and try **Login** or **Signup**. If the toast still says “Supabase not configured”, env is not reaching the client (check variable names and restart).

---

## 5. Verify behaviour

- [ ] **Login** (email or phone + password/pin) → success, user in context, navigates to `/(tabs)`.
- [ ] **Signup** (email) → signUp succeeds, send-otp succeeds (no 404), navigate to OTP screen; after verify-otp → session, navigate to `/(tabs)`.
- [ ] **Signup** (phone) → signUp succeeds, navigate to OTP or `/(tabs)` if session returned.
- [ ] **Forgot password** → send-otp succeeds; enter code + new password → reset-password-with-otp succeeds; can log in with new password.
- [ ] **Session restore** — close app, reopen → still logged in (Supabase session from AsyncStorage).
- [ ] **Logout** → user cleared, navigate to login.
- [ ] **Same Supabase project** — same user can log in on web and mobile with same credentials.

---

## 6. Optional: backend pin reset

- **reset-pin** flow calls `reset-password-with-otp` with `{ phone, code, newPassword }`. The current edge function only accepts `email`. To support pin reset by phone, extend the edge function to accept optional `phone` and look up user by phone. Until then, pin reset may fail unless the backend is updated.

---

## 7. Quick reference

- **Supabase client:** `lib/supabase/client.ts` (reads `EXPO_PUBLIC_SUPABASE_*`).
- **Web project ref:** `vzdambpwxcxzzhtkvqnk` (in `mbukanji-maps/supabase/config.toml`).
- **Deploy doc:** `DEPLOY_SUPABASE_EDGE_FUNCTIONS.md`.
- **Full plan:** `AUTH_SUPABASE_FULL_PARITY_IMPLEMENTATION_PLAN.md`, `SUPABASE_AUTH_PARITY_IMPLEMENTATION_TASK.md`.
