# Mobile Create Address — Plan (Match Web Flow)

This document maps the **web** Create Address flow (docs/src/pages/CreateAddressPage.tsx) to the **mobile** implementation (app/new-create-address.tsx) so mobile behaves the same way step by step.

---

## 1. Entry / Location Source

| Web | Mobile |
|-----|--------|
| Page gets **lat, lon from URL** (search params). | Screen gets **lat, lon from route params** when opened from map; otherwise from **@currentCoordinates** or GPS. |
| Single “active location” = that lat/lon. | Single “coordinates” = that lat/lon (snapped to grid when from params; no grid center). |

**Alignment:** Use the **same** coordinates for all address resolution on the create screen (no grid center). Done.

---

## 2. Initial Load — Single Source of Truth

| Web | Mobile |
|-----|--------|
| On load: runs **resolveStreetAddress(lat, lon, 60)** once at page coordinates. | On create screen: when coordinates and init are ready, run **resolveStreetAddress(lat, lon, 60)** once at page coordinates. |
| Form is filled **only** from that result: street, house number, side, chainage, neighborhood, city, region, country (from result.admin + getAddressComponentsSync when OSM-style address exists). | Form is filled from **resolveStreetAddress** result: street, house number, streetKey, neighborhood, city, region, country from **result.admin**, geometry and distance from result.activeStreet/street. |
| **Original API values** stored (originalApiStreetName, originalApiNeighborhood) for later “did user edit?” check. | Store **originalApiStreetName**, **originalApiNeighborhood** when setting from resolve result (for future dual-address / suggestions). |

**Alignment:**  
- **Always** run resolveStreetAddress at page coordinates (whether opened from map or not).  
- Use that result as the **canonical** source for street, house number, admin, geometry, streetKey, distance.  
- Optional: show params prefill first for instant display, then **overwrite** with resolve result when it arrives.  
- Set original street/neighborhood when filling from resolve result.

---

## 3. Map Click to Change Location (Web Only Today)

| Web | Mobile |
|-----|--------|
| User can click map → URL updates → checkLocationAddress at new point → FOUND: view existing address; NOT FOUND: resolveStreetAddress at new point and refill form. | Create screen does not support “tap map to change location” today; user picked location on map tab then navigated. |

**Alignment:** Optional later: if mobile adds “tap map to change location” on create screen, run the same check + resolve at new coords and refill form (like web).

---

## 4. Pick a Street (Alternate Street Selection)

| Web | Mobile |
|-----|--------|
| “Pick a Street” panel shows **nearbyStreets** from resolve result; user can select another street → house number recalculated for same lat/lon, form updated. | No “Pick a Street” UI on create screen today. |

**Alignment:** Optional later: add list of nearby streets from resolve result and, when user picks one, recalc house number (same as web).

---

## 5. Form Fields and Validation

| Web | Mobile |
|-----|--------|
| Required: location, property type, connection, photo (or “create upload link”), street name. | Same: location (coordinates), address category ~ property type, connection, image (or upload link), street (and neighborhood in step 1). |
| User can edit street name and neighborhood; edits tracked via originalApi* for dual-address. | User can edit street (EditStreet) and neighborhood; store originals when filling from resolve for future use. |

**Alignment:** Validation and required fields already aligned; originals set when filling from resolve.

---

## 6. Submit (Create Address)

| Web | Mobile |
|-----|--------|
| Build payload from form (house number, street, neighborhood, city, region, country from addressData.osmData, side, chainage, distance, etc.). | Same: build from form state (house number, street, neighborhood, city, region, country, etc.). |
| **Single address:** SyncManager.createAddress(…), then **autoLockOnFirstAddress(streetKey)**. streetKey = normalizeStreetKey(originalApiStreetName \|\| streetName, city, osmId). | Same: SyncManager.createAddress(…), then **autoLockOnFirstAddress(streetKey)**. streetKey = streetKeyFromGeocode \|\| normalizeStreetKey(street, city). |
| **Dual address (if user edited street/neighborhood):** create official + user-suggested, link them, create suggestion records. | Optional later: add dual-address and suggestion records when user edited. |

**Alignment:**  
- Create one address, then autoLockOnFirstAddress(streetKey).  
- Use streetKey from resolve result (streetKeyFromGeocode) when available, else normalizeStreetKey(street, city).  
- Mobile already does this in proceedWithCreation.

---

## 7. Summary of Implementation Steps (Mobile)

1. **Single source of truth**  
   When coordinates and init are ready, **always** run resolveStreetAddress(lat, lon, 60) on the create screen. Fill form from that result (street, house number, result.admin for neighborhood/city/region/country, streetKey, geometry, distance). Do **not** skip resolve when “from map”; resolve on this screen is canonical (like web).

2. **Original API values**  
   When filling from resolve result, set originalApiStreetName and originalApiNeighborhood so we can detect user edits later (for dual-address/suggestions).

3. **Params prefill**  
   Keep instant prefill from route params when opened from map; then the resolve run **overwrites** with canonical data so the final state matches web (one pipeline = resolve at page coords).

4. **Submit**  
   Use streetKeyFromGeocode or normalizeStreetKey(street, city). After SyncManager.createAddress, call autoLockOnFirstAddress(streetKey). Already aligned; verify.

5. **Optional later**  
   Map tap to change location on create screen; Pick a Street panel; dual-address when user edited.

---

## File Reference

- Web: `docs/src/pages/CreateAddressPage.tsx`
- Mobile: `app/new-create-address.tsx`
- Shared: `lib/offlineDataPacks.ts` (resolveStreetAddress), `lib/streetDirectionService.ts` (autoLockOnFirstAddress, normalizeStreetKey), `lib/createLocationAddress.ts` (calculateHouseNumberSync)
