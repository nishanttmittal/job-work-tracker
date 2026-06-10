# UNICO Plating Job Work — ACTUAL Implemented Status

**Code read: 2026-06-08.** Only what is actually implemented. No planned features.
✅ fully working · 🟡 partial · 🟦 dormant/placeholder (code exists, not wired) · 🔴 not implemented.

| Area | Status | What is actually there |
|---|---|---|
| **Challans** | ✅ | — |
| **Receive-back (IN)** | ✅ | — |
| **Dashboard** | ✅ | — |
| **Reports** | ✅ | — |
| **Payment** | 🔴 | — |
| **Contractor ledger** | 🔴 | — |
| **Security** | 🔴 | — |
| **Firestore rules** | 🟡 | — |
| **Google auth** | 🟡 | — |
| **Cross-app integration** | 🔴 | — |
| **Welder app integration** | 🔴 | — |
| **Tests** | ✅ | — |

---

## ✅ Challans — fully working
- Create **one challan = one date + party + direction + many product line items** (bulk entry).
- **Unique numbering `PJW-0001`** via an **atomic Firestore transaction** on `meta/counter` → duplicate-proof even across devices/phones. (Local/offline fallback uses `max(counter, highest existing)+1` with a collision-guard loop.)
- Stored **one document per challan** (`apps/platingjobwork/challans/{id}`) → concurrent edits never clobber.
- Live **pending-balance preview** per product at the chosen party while entering.
- **Double-save guard** (disabled button + `saving` flag).
- Every create writes an **audit log** line.
- 🟡 caveat: creating a challan **requires internet** (server-issued number) — see Security/risks.

## ✅ Receive-back (IN) — fully working
- Same challan form with **direction = IN ("received back")**.
- Balance is derived: **`pending = Σ OUT − Σ IN`** per party+product.
- Over-receiving (**IN > OUT**) surfaces as a 🚩 red-flag on the dashboard (safety net for wrong receive qty).
- OUT and IN are **independent challans** — there is **no challan-to-challan return matching**; reconciliation is by net balance only.

## ✅ Dashboard — fully working
- **Party-wise pending** summary (net + per-product breakdown; amber = pending, red = excess).
- **7-day aging reminders** (OUT pending ≥ `OUT_REMINDER_DAYS`, from the oldest OUT date).
- **Red-flag alerts** (IN > OUT).
- **Per-party balance tables** (Out / In / Pending with totals).
- **Reconciliations** summary + **recent 5 challans**.
- **Party view filter** applies to the whole dashboard. All **derived live** from challans (nothing double-stored).

## ✅ Reports — fully working
- **Two PDF reports** (jsPDF + autotable), per party:
  1. **Date-wise transactions** (challan / date / product / dir / qty / gaadi over a date range).
  2. **Balance summary** as of a date (Sent / Received / Pending + totals).
- Shared via the **native share sheet → WhatsApp** on mobile; **downloads** on desktop.
- 🟡 minor: report is **per single party** (no all-parties combined report).

## 🔴 Payment — not implemented
- No rates, no payment recording, no payment slips, no modes — **nothing payment-related exists in this app.** (Contractor payments live in the separate **Welder** app.)

## 🔴 Contractor ledger — not implemented
- No ledger, running balance, advances, adjustments or settlement here. (Also a Welder-app feature.)

## 🔴 Security — not implemented (effective)
- **No login wall.** Anyone with the URL can **create challans, view the dashboard, and export** — no identity captured on entries.
- **Gates are UI-only:** the Modify password (`nsp@123`) and Admin gate hide screens but do **not** restrict the database.
- **Passwords shipped in client** `config.js` (`nsp@123`, `6133923_N`) — visible in page source.
- At the database level, **any signed-in (anonymous) user can read/write everything** under `apps/platingjobwork`.

## 🟡 Firestore rules — present but permissive
- Rules **exist and are deployed**: `apps/platingjobwork/**` → `allow read, write: if request.auth != null;` (everything else denied).
- 🟡 **Not role-based**: anonymous sign-in satisfies the rule, so the rules keep data off the public internet but do **not** enforce worker/manager/admin separation. The real access control is only in the UI.

## 🟡 Google auth — partial (identity check only)
- `AdminGate` offers **Google sign-in pinned to `nspenterprises24@gmail.com`** (via `verifyAdminGoogle`, run on an **isolated secondary Firebase app** so the main anonymous session is untouched), **or** the admin password as fallback.
- 🟡 It only **unlocks the Admin UI** — it does **not** change who can read/write the database (rules still treat the user as anonymous). The whole app's data sync runs on **anonymous auth**.

## 🔴 Cross-app integration — not implemented
- The app uses the **shared `unico-operations` project** under its own namespace `apps/platingjobwork` (so other apps *could* read it) — but there is **no actual cross-app read or write** in the code. The shared project is namespacing/readiness only, not integration.

## 🔴 Welder app integration — not implemented
- The Welder app builds a **"Plating Outbox" preview** and defines `platingPaths`, but **nothing is ever pushed** (welder outbox rows stay `pushed: false`; `platingPaths`/push code is **dormant on the welder side**).
- The Plating app does **not** read anything from the Welder app.
- Net: **the two apps are not connected** in either direction.

## ✅ Tests — working / extensive
- Large Playwright + Node suite: `test-v2`, `test-cloud-sync`, `test-unique`, `test-recon`, `test-partywise`, `test-admin-gate`, `test-modify-gate`, `test-nodelete`, `test-negative`, `test-iphone-*`, `test-filter`, `test-import`, etc., plus cloud diagnostics (`diag-*`, `verify-cloud`, `cleanup-*`). Coverage is notably broader than the Welder app.
- `vite build` produces a working installable PWA.

---

## Known risks

| # | Risk | Severity | Note |
|---|---|---|---|
| 1 | **No real auth / UI-only gates** | 🔴 High | Anyone with the link can create/view/export; passwords are in client code; anonymous users can write any plating doc at the DB level. |
| 2 | **Not offline-capable** | 🔴 High | Firestore uses an **in-memory cache** (IndexedDB disabled for iOS Safari) + auto long-polling. App needs internet; **challan creation fails offline** (server-issued number). Code comments claiming IndexedDB offline are stale. |
| 3 | **No per-challan delete** | 🟡 | Deletion is admin-only and **by date range** (or full reset) — no single-challan delete; restore is destructive (replace, not merge). |
| 4 | **Scale ceilings** | 🟡 | `onSnapshot` loads **all** challans into memory; balances recomputed client-side each render; **no pagination/date-window**. Fine for thousands, heavy at tens of thousands. |
| 5 | **Party rename doesn't cascade** | 🟡 | Product rename cascades into line items; **party** rename does not. |
| 6 | **No OUT↔IN linkage / no QC/reject** | 🟡 | Only net balance; no partial-return tracking, no rework/reject status. |
| 7 | **Single factory** | 🔴 | No `factoryId`; one namespace. |
| 8 | **Welder↔Plating link dormant** | 🔴 | Intended hand-off not wired on either side. |

---

### One-line summary
**Fully working:** atomic-numbered, concurrency-safe plating in/out register — bulk challans, derived party-wise balances, aging + over-receive alerts, 24h edit-lock + admin reconciliation, Excel import, audit log, backup/restore, and WhatsApp PDF reports.
**Partial:** Firestore rules (present but permissive) and Google auth (UI identity check only).
**Not implemented:** payments, contractor ledger, real security, offline, cross-app & welder integration.
