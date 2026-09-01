# Bulk Update Events via CSV

## Goal
Ek hi baar me 50+ events ke details (jaise ERP Invoice No, POSist Code, SPOC, Category, Zone) CSV upload karke update karna. Feature sirf un users ko dikhega jinhe Super Admin permission dega.

## 1. Permission system (per-user)
- Nayi table `user_permissions` (user_id + permission name). Roles se alag, taaki Super Admin kisi bhi individual user ko extra feature de sake.
- Pehla permission: `bulk_update_events`.
- Users page me har user ke saamne ek toggle: "Bulk Update Access". Sirf Super Admin toggle kar sakta hai.
- Super Admin ko permission by default milegi.

## 2. Bulk Update screen
- Nayi tab/page: **Events → Bulk Update** (button events list ke header me, sirf permitted users ko visible; route bhi permission se guarded).
- Flow:
  1. **Download template** — CSV jisme `event_ref_code` + sabhi editable columns headers, aur chahe to current data ke saath (filtered events ka export).
  2. **Upload CSV** — file parse hoke preview table dikhega.
  3. **Preview & validate** — har row par: matched event ka naam/date, kaunse fields change ho rahe hain (purana → naya, highlighted), aur errors (ref code not found, invalid date, invalid dropdown value, locked event).
  4. **Apply** — sirf valid rows update hongi; end me summary: X updated, Y skipped, errors ki list download.

## 3. Matching
- `event_ref_code` (BWC001) se match. Case-insensitive, extra spaces trim.
- Ref code na mile → row skip + error.
- Blank cell = "change mat karo" (field ko khaali karne ke liye alag keyword `[CLEAR]`).

## 4. Editable fields (sirf ye)
ERP Invoice No, Invoice Code, Invoice Date, POSist Code, Client Name, Client Sub Name, Referral Details, Registration Status, Area, City, State, Zone, SPOC, Category, Venue, Expected Payment Date, Finance Clearance, Additional Remarks, Event Team Remarks, Remark.

Financial aur payment/lock fields bulk update me **nahi** honge (safety).

## 5. Rules
- Locked events (full payment received): Super Admin hi update kar payega; baaki users ke liye wo rows skip with reason.
- Dropdown fields (Zone, Category, Registration Status, Finance Clearance) me sirf allowed values accept hongi, warna row error.
- Dates `DD-MM-YYYY` aur `YYYY-MM-DD` dono accept.
- Max 1000 rows per file.
- Har update audit_logs me already trigger se record ho jaata hai — no extra work.

## Technical notes
- Table: `public.user_permissions (id, user_id, permission text, created_at)`, unique(user_id, permission), RLS: user apni permissions padh sake, Super Admin manage kare. Helper function `has_permission(_user_id, _permission)`.
- Events UPDATE RLS unchanged — bulk update client se `events` table par chunked updates (batches of ~25) karega, taaki existing triggers (EBITDA, financial year, audit) normally chalein.
- CSV parsing client-side (papaparse), koi edge function nahi.
- Naya file: `src/pages/BulkUpdate.tsx` + `src/hooks/usePermissions.ts`; changes: `src/App.tsx` (route), `src/pages/Users.tsx` (permission toggle), `src/pages/Events.tsx` (entry button).

## Out of scope
- In-app row-select bulk edit (aap ne sirf CSV chuna).
- New events CSV se create karna (sirf update).
- Payments/documents ka bulk import.
