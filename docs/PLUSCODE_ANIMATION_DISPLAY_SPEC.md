# Plus Code Animation & Display Spec

Single source of truth for how the **active Plus Code cell** and **GPS location** are drawn and animated on the map. Web and mobile must both implement this behavior.

---

## State definitions

- **Active location** = The Plus Code cell the user is currently working with (where they will create or check an address). Comes from store/state (e.g. `activeLocation`).
- **GPS location** = The device’s current position. Comes from store/state (e.g. `userLocation`).
- **Neighbors** = The 8 Plus Code cells surrounding the “center” used for the 9-cell grid (center = GPS when restricted, or the grid origin in use).

---

## State 1: Active = GPS (user has not clicked elsewhere)

| Element | What to show |
|--------|----------------|
| **Active cell (same as GPS)** | **Marching ants only** – Animated dashed border moving clockwise (or equivalent). Static blue fill at low opacity (e.g. 25%) is acceptable; no pulsing. |
| **8 neighbor cells** | Static green fill and border. No animation. |
| **GPS breadcrumb** | **Do not show.** There is no separate “GPS” box because GPS and active are the same cell. |

Result: One highlighted cell (the center) with marching ants; no second box.

---

## State 2: Active ≠ GPS (user clicked one of the 8 neighbors)

| Element | What to show |
|--------|----------------|
| **Active cell (clicked neighbor)** | **Marching ants** – Same animated dashed border as in State 1. This is “where the user is creating address.” |
| **GPS location** | **Pulsing fill** – A separate cell (breadcrumb) drawn at GPS. Use a breathing/pulsing opacity (or color) animation to mean “your GPS is here, but you selected another cell.” Optional: static outline. |
| **Other 7 neighbors** | Static green. No animation. |

Result: Marching ants on the selected cell; pulsing fill on the GPS cell; no pulsing on the active cell.

---

## Display rules (summary)

1. **Marching ants** → Always on the **active** Plus Code cell only.
2. **Pulsing fill** → Only on the **GPS** cell, and only when **active ≠ GPS** (i.e. when the GPS cell is shown as breadcrumb).
3. **When active = GPS** → No breadcrumb; no pulsing; only marching ants on the center cell.
4. **When active ≠ GPS** → Marching ants on active cell; pulsing on GPS cell (breadcrumb); neighbors stay static.

---

## Implementation notes (platform-agnostic)

- **Same cell check** – Use a single definition of “same Plus Code cell” (e.g. same grid cell bounds or same plus code string) so web and mobile agree when active = GPS.
- **Restriction** – If the product requires the breadcrumb only for restricted users (e.g. basic_user), that is an extra condition on *whether* the GPS breadcrumb is allowed; the rules above still apply when the breadcrumb is shown.
- **Performance** – Marching ants and pulsing should use a single timer or requestAnimationFrame loop per layer where possible to avoid multiple timers.

No code in this doc; implementations stay in web and mobile codebases and follow this spec.

---

## Implementation (mobile)

- **MapViewMapLibre.tsx** – Center Plus Code cell: static blue fill (FillLayer) + **MarchingAntsBoxOverlay** (SVG overlay, getPointInView, Reanimated strokeDashoffset 1s cycle, 8–4 pattern). Neighbors: static green. No pulsing on active cell.
- **GPSLocationLayer.tsx** – GPS breadcrumb: shown only when active and GPS are different grid cells (`isSameGridCell`). When shown: pulsing fill (opacity animation) + static outline. Rendered above the grid so it draws on top.
- **app/(tabs)/index.tsx** – Passes `showOnlyWhenOffset={true}` and `showOnlyWhenRestrictedAndOffset={true}` to `GPSLocationLayer` so breadcrumb (and pulsing) appear only when **location-restricted (basic_user)** and active ≠ GPS (web parity). Web uses static fill on the breadcrumb; mobile keeps **pulsing** as an intentional enhancement (this spec).
