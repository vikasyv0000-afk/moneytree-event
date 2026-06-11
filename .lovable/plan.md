# Unlock Event Feature (Super Admin only)

## Goal
When an event is locked (Full Payment Received), only **Super Admin** users should see an **Unlock Event** button on the event detail page. Clicking it unlocks the event so it can be edited again.

## Scope
Only Super Admin (`super_admin`). Events and Finance users will not see the button — they remain blocked from editing locked events (current behavior).

## Changes

### 1. Database migration
Add a `SECURITY DEFINER` function `public.unlock_event(_event_id uuid)` that:
- Verifies the caller has `super_admin` role via `has_role(auth.uid(), 'super_admin')` — raises exception otherwise.
- Updates `events` row: `is_locked = false`, `full_payment_received = false`, `status = 'active'`.
- Returns the updated row.
- `GRANT EXECUTE ... TO authenticated` (the function itself enforces the role check).

Note: the existing `auto_populate_event_fields` BEFORE UPDATE trigger re-locks the row whenever `full_payment_received = true`, so we must also set `full_payment_received = false` in the unlock (matches the existing "lock on full payment" rule). An audit_log entry is written automatically by the existing `audit_log_trigger` on `events`.

### 2. `src/components/events/EventDetail.tsx`
In the header section (around line 436–438, next to the "Locked — Full Payment Received" label):
- If `isLocked && isSuperAdmin`, render an **Unlock Event** button (outline, `Unlock` icon from lucide-react).
- On click: confirm dialog → call `supabase.rpc('unlock_event', { _event_id: event.id })` via a `useMutation`.
- On success: invalidate event queries, show toast "Event unlocked", event becomes editable again (existing `canEdit` logic already allows edit once `is_locked` is false).
- Show pending state on the button while mutation runs.

No other files need changes. Events list / dashboard pick up the change automatically via the existing realtime sync.

## Out of scope
- No UI change for non-admin users.
- No bulk unlock.
- No new permission roles.
