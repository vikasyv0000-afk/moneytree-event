## Goal
Clients master me har client ka **Zone** dikhe (North / South / East / West), aur upar ek **Filter by Zone** dropdown ho jisse list filter ho.

## Changes

### 1. Database (migration)
- `public.clients` me column add: `zone text` (nullable, no default).
- Koi CHECK constraint nahi — values UI dropdown se control hongi (North/South/East/West), taaki future me naye zones add karna easy ho.

### 2. Add Client dialog (`src/pages/Masters.tsx` → `ClientTab`)
- Form state me `zone: ""` add.
- GST Number ke pass ek naya field: **Zone** (Select dropdown) with options: North, South, East, West. Optional rakhenge (mandatory nahi).
- Insert payload me `zone` include.

### 3. Clients table UI
- Header me **Filter by Zone** dropdown add (options: All, North, South, East, West). Default = All.
- Table me naya column **Zone** (Sub Name ke baad).
- Query: server-side filter — `supabase.from("clients").select("*").eq("zone", selectedZone)` jab All na ho; queryKey me zone include.
- Empty state: "No clients in this zone".

### 4. Edit support (optional but minor)
- Existing clients ka zone set karne ke liye: row me Zone cell ko inline editable Select banayenge (same 4 options + blank). Change pe `update({zone}).eq("id", c.id)` + query invalidate.

## Out of scope
- Events ke zone se auto-link nahi ho raha.
- SPOC tab me koi change nahi.
- Bulk zone assign nahi.
