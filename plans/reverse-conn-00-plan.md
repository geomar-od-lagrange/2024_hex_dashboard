# Reverse Connectivity — Plan

Branch: `explore/reverse-connectivity`

## Goal

Add an **incoming toggle** to the UI: instead of showing where water from a
source hex disperses to (forward/outgoing), show which source hexes contribute
to the water at a target hex (reverse/incoming).

**Physical interpretation of incoming view:**
Put the same dye concentration into every connected, habitable source hex
simultaneously. Measure concentration at the target. Show each source's
percentage of the total.

---

## Science

Forward weight stored in DB:
```
F(s→t) = [obs_sum / (N_s × DT_h × n_months_years)] × (wf_s / wf_t)
```
This is concentration at t per unit concentration at s.

Fractional contribution of source s to target t:
```
share(s→t) = F(s→t) / Σ_s F(s→t)
```

`wf_t` cancels in the ratio, so the stored F values are sufficient — no schema
change needed.

**Habitable filter semantics (critical):**
When the habitable toggle is ON, non-habitable hexes are excluded from the
denominator entirely — not just hidden visually. They cannot host populations
and are not meaningful sources. The sum is over habitable sources only:
```
share(s→t) = F(s→t) / Σ_{s ∈ habitable} F(s→t)   [habitable ON]
share(s→t) = F(s→t) / Σ_s F(s→t)                  [habitable OFF]
```

---

## Changes

### 1. DB — add reverse query index

`database/init/init_db.py` (or a migration script)

```sql
CREATE INDEX idx_connect_dtr_inc_reverse
ON connectivity_table (depth, time_range, end_id)
INCLUDE (start_id, weight);
```

Existing index covers forward queries; this covers reverse.

### 2. API — new endpoint `/connectivity-sources`

`api/server.js`

```
GET /connectivity-sources?end_id=42,100&depth=05m,10m&time_range=07d-14d&habitable=true
```

- Filter by `end_id` (not `start_id`)
- When `habitable=true`: join `metadata_table` and restrict source rows to
  `m.habitable = 1`
- Aggregate by `start_id` using same time-weighted mean as `/connectivity`
- Compute fractional shares server-side: `weight / SUM(weight)` after
  aggregation
- Return `[{ start_id, weight (fractional share 0–1), raw_weight (absolute F) }]`
- Apply log-normalisation to `weight` for visual encoding (same as forward)
- No `404` when result is empty — just return `[]`

Validation: mirror `/connectivity` (same depth/time_range rules; `end_id`
instead of `start_id`, same integer validation, max 10 000 items).

### 3. Frontend types

`frontend/src/App.tsx`

```ts
type ConnDirection = 'downstream' | 'upstream';

type SourceConnection = {
  start_id: number;
  weight: number;       // log-normalised, for visual encoding
  raw_weight?: number;  // fractional share 0–1, for tooltip
};
```

### 4. Frontend state & fetch

`frontend/src/App.tsx`

Add:
```ts
const [direction, setDirection] = useState<ConnDirection>('forward');
const [sourceConnections, setSourceConnections] = useState<SourceConnection[]>([]);
```

Second fetch effect, triggered by `[clickIds, selectedTimes, selectedDepths,
direction, isHabitableShown]`:
- If `direction === 'downstream'`: existing fetch (unchanged)
- If `direction === 'upstream'`: fetch
  `/connectivity-sources?end_id=...&depth=...&time_range=...&habitable=<bool>`

When direction changes: clear both `connections` and `sourceConnections`.

`weightMap` derived from active direction:
```ts
const weightMap = useMemo(() => {
  if (direction === 'downstream')
    return new Map(connections.map(c => [c.end_id, c.weight]));
  return new Map(sourceConnections.map(c => [c.start_id, c.weight]));
}, [direction, connections, sourceConnections]);

const rawWeightMap = useMemo(() => {
  if (direction === 'downstream')
    return new Map(connections.filter(c => c.raw_weight != null).map(c => [c.end_id, c.raw_weight!]));
  return new Map(sourceConnections.filter(c => c.raw_weight != null).map(c => [c.start_id, c.raw_weight!]));
}, [direction, connections, sourceConnections]);
```

The selected hex (orange) is always the clicked hex — it's the source in
forward mode and the target in reverse mode. No change to click/selection logic.

### 5. Tooltip — reverse mode label

`frontend/src/App.tsx` (tooltip construction)

- Forward: `rel conc X.XX · 10^N` (unchanged)
- Reverse: `source contrib X.X%` (raw_weight × 100, formatted to 1 decimal)

### 6. Scale bar label

`frontend/src/ControlPanel.tsx`

Pass `direction` prop; show context-sensitive label:
- Forward: `Relative concentration (logarithmic scale)` (unchanged)
- Reverse: `Source contribution (logarithmic scale)`

### 7. ControlPanel — direction toggle

`frontend/src/ControlPanel.tsx`

Add a slide toggle (same style as habitable toggle) placed **above** the
habitable toggle:

```
[ toggle ] upstream
           click target(s) · see their sources
```

When OFF (default): downstream mode — existing behaviour.
When ON: upstream mode.

`ConnDirection` values renamed accordingly: `'downstream' | 'upstream'`.

Props added:
```ts
direction: ConnDirection;
onDirectionChange: (d: ConnDirection) => void;
```

---

## What does NOT change

- DB schema (no new tables; one new index)
- Forward connectivity logic — untouched
- Category highlight layers, layer stacking, habitable dimming display
- Click/selection logic — selected hex always shown orange
- Depth/time-range checkboxes — same semantics in both directions

---

## Files touched

| File | Change |
|------|--------|
| `database/init/init_db.py` | Add reverse index |
| `api/server.js` | Add `/connectivity-sources` endpoint |
| `frontend/src/App.tsx` | `direction` state, second fetch, unified weightMap, tooltip label |
| `frontend/src/ControlPanel.tsx` | Direction toggle, scale bar label, new props |

---

## YOUR QUESTIONS/NOTES

- Direction toggle placement: above habitable toggle — OK?
- Toggle labels: downstream (off) / upstream (on) — confirmed.
- Multi-target upstream: aggregate by source across all selected targets
  (time-weighted mean per source), then compute fractional shares over the
  pooled result — confirmed, same as downstream multi-select.
