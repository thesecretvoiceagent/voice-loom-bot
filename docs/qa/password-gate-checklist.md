# Password Gate — UI Test Checklist

Verifies the global access gate on **https://app.beyondcode.ai** (and all preview/published URLs that share the `MainLayout`).

- **Expected password:** `Kuh26uTa!`
- **Storage key:** `bc_access_granted_v1` (set in either `localStorage` or `sessionStorage`)
- **Gate component:** `src/components/auth/PasswordGate.tsx` (wraps `MainLayout`)

---

## 1. First-visit prompt

1. Open an **incognito / private window**.
2. Navigate to `https://app.beyondcode.ai/`.
3. ✅ The "BeyondCode AI — Enter access password to continue" screen is shown.
4. ✅ No dashboard, sidebar, or app content is visible behind it.
5. ✅ URL stays on `/` (no redirect).

## 2. Wrong password is rejected

1. From the password screen, enter `wrong-password` and submit.
2. ✅ Toast shows **"Incorrect password"**.
3. ✅ Password field is cleared.
4. ✅ Gate stays in place (no app content visible).

## 3. Correct password grants access

1. Enter `Kuh26uTa!` exactly.
2. Leave **"Remember on this device"** checked.
3. Submit.
4. ✅ Toast shows **"Access granted"**.
5. ✅ Dashboard renders (sidebar + main content).
6. ✅ DevTools → Application → Local Storage → `https://app.beyondcode.ai` contains key `bc_access_granted_v1` with value `1`.

## 4. Persistence across reloads

1. After step 3, hard reload (`Ctrl/Cmd + Shift + R`).
2. ✅ Dashboard loads directly — **no** password prompt.
3. Navigate to `/agents`, `/admin`, `/analytics`.
4. ✅ All routes render without re-prompting.

## 5. Clearing storage re-locks access (the critical test)

1. Open DevTools → Application → Storage.
2. Delete `bc_access_granted_v1` from **both** Local Storage and Session Storage for `https://app.beyondcode.ai`.
3. Reload the page.
4. ✅ Password gate is shown again.
5. ✅ Attempting to navigate to `/admin`, `/agents`, `/analytics`, `/settings`, `/calls`, `/campaigns`, `/items`, `/system-health`, `/feature-flags`, `/incidents` while gated shows the password screen for each (no protected content flashes).

## 6. Session-only mode

1. Clear storage as in step 5.
2. Enter `Kuh26uTa!`, **uncheck** "Remember on this device", submit.
3. ✅ Access granted, dashboard loads.
4. ✅ DevTools → Session Storage contains `bc_access_granted_v1 = 1`; Local Storage does **not**.
5. Close the tab, reopen `https://app.beyondcode.ai/` in a new tab of the same window.
6. ✅ Password gate is shown again (session storage is per-tab).

## 7. Tenant workspace routes are independent

1. While **gated** on the main domain (storage cleared), navigate to `/<tenantSlug>` (e.g. `/acme`).
2. ✅ Tenant workspace uses its **own** `TenantGate` (not the main `PasswordGate`) — confirms isolation.
3. Returning to `/` still requires the main `Kuh26uTa!` password.

## 8. Public routes bypass the gate (sanity check)

These routes are intentionally **outside** `MainLayout` and must remain accessible without the password:

- `/location?...` (LocationConfirm — SMS link during live calls)
- `/form?...` (FormSubmit — SMS link during live calls)

✅ Both load directly with no password prompt, even with storage cleared.

---

## Quick reset snippet (paste in DevTools console)

```js
localStorage.removeItem('bc_access_granted_v1');
sessionStorage.removeItem('bc_access_granted_v1');
location.reload();
```

Use this between test runs to force the gate back on without manually clicking through DevTools storage panels.
