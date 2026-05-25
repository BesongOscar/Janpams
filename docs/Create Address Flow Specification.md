# Create Address Flow Specification

## Document: `docs/SPEC_CreateAddress_Flow.md`

This specification fully documents the Create Address flow with all technical implementation details.

---

## 1. Mode Entry: User Clicks "Address" Button

When user clicks "Address" (via `ModeToggle` component), the system should:

- **Default automatically to "Address" mode** for the Web React app
  - Component: `src/components/map/ModeToggle.tsx`
  - Calls `enterAddressMode()` from `useAddressModeEntry` hook

- **Set `appMode: 'address'`** in the global Zustand store
  - Store: `src/store/mapStore.ts`
  - State change: `setAppMode('address')`

- **Set `gridVisible: true`** to display the Plus Code grid overlay
  - State change: `setGridVisible(true)`
  - Grid appears at zoom ≥ 8 with 70% opacity white lines

- **Check for cached GPS location** in `userLocation` store state:
  - **If cached GPS exists** → use immediately, mark source as `'gps'`
  - **If no cached GPS** → attempt `getCurrentPosition()` with progress callbacks:
    - **Success** → store in `userLocation`, mark source as `'gps'`, proceed
    - **Failure** → enable `mapSelectionMode: true`, show blue toast:
      - Text: "Tap the map to select your location"
      - Description: "GPS is unavailable. Please tap on the map to choose a location."
      - Duration: 6000ms
      - Background: `hsl(240, 100%, 47%)` (JanGo Blue)

- **Dispatch `map-fly-to` custom event** to zoom to user's location
  - Event: `window.dispatchEvent(new CustomEvent('map-fly-to', { detail: { lat, lon, zoom: 18 } }))`
  - MapView listens for this event and executes `map.flyTo()` with 1000ms duration

- **Set `activeLocation`** to GPS coordinates
  - State: `{ lat, lon, timestamp: Date.now() }`
  - GPS location = Active Location initially

- **Set `activeLocationSource: 'gps'`** to mark location as GPS-sourced
  - Used for trust policy enforcement later

- **Calculate 10-character Plus Code**
  - Function: `encode(lat, lon, 10)` from `src/lib/pluscode.ts`
  - Example output: `6FXVRM3H+R5`

- **Perform `checkLocation(lat, lon, navigator.onLine)`**
  - Service: `src/lib/addressServices.ts` → `checkLocationAddress.ts`
  - Stores result in `locationCheckResult` state

- **Open the sidebar**
  - State change: `setSidebarCollapsed(false)`

---

## 2. Map Visualization: Marching Ants Animation

The marching ants animation is implemented as an **SVG overlay layer** that renders on top of the MapLibre GL map.

### SVG Overlay Component

**Component:** `MarchingAntsOverlay` in `src/components/map/MapView.tsx` (lines 49-130)

```typescript
const MarchingAntsOverlay = ({ bounds, mapInstance }: SvgOverlayProps) => {
  // State for rectangle position/size in screen coordinates
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Convert geographic bounds to screen pixel coordinates
  const updateRect = useCallback(() => {
    if (!bounds || !mapInstance) { setRect(null); return; }
    
    const sw = mapInstance.project([bounds.sw[1], bounds.sw[0]]); // [lon, lat]
    const ne = mapInstance.project([bounds.ne[1], bounds.ne[0]]);
    
    setRect({
      x: Math.min(sw.x, ne.x),
      y: Math.min(sw.y, ne.y),
      width: Math.abs(ne.x - sw.x),
      height: Math.abs(ne.y - sw.y)
    });
  }, [bounds, mapInstance]);

  // Subscribe to map move/zoom/resize events to keep overlay in sync
  useEffect(() => {
    if (!mapInstance) return;
    mapInstance.on('move', updateRect);
    mapInstance.on('zoom', updateRect);
    mapInstance.on('resize', updateRect);
    return () => {
      mapInstance.off('move', updateRect);
      mapInstance.off('zoom', updateRect);
      mapInstance.off('resize', updateRect);
    };
  }, [mapInstance, updateRect]);

  if (!rect) return null;

  return (
    <svg style={{
      position: 'absolute',
      top: 0, left: 0,
      width: '100%', height: '100%',
      pointerEvents: 'none',
      zIndex: 20,
      overflow: 'visible',
    }}>
      <rect
        x={rect.x} y={rect.y}
        width={rect.width} height={rect.height}
        fill="none"
        stroke="#0000EE"          // JanGo Blue
        strokeWidth="3"
        strokeDasharray="8 4"     // 8px dash, 4px gap
        className="marching-ants"
      />
    </svg>
  );
};
```

### CSS Animation

**File:** `src/index.css` (lines 211-228)

```css
/* Marching ants animation for Plus Code box */
.marching-ants {
  animation: marching-ants-box 1s linear infinite;
}

@keyframes marching-ants-box {
  0% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: -12;  /* Negative = moves clockwise */
  }
}
```

### How Bounds Are Calculated

**Function:** `getGridBounds(lat, lon)` in `src/lib/pluscode.ts`

```typescript
export function getGridBounds(lat: number, lon: number): GridBounds {
  const gridSize = 0.000125; // ~14m x 14m at equator
  const gridLat = Math.floor(lat / gridSize) * gridSize;
  const gridLon = Math.floor(lon / gridSize) * gridSize;
  
  return {
    sw: [gridLat, gridLon],                     // Southwest corner
    ne: [gridLat + gridSize, gridLon + gridSize] // Northeast corner
  };
}
```

### Drawing Flow

1. User enters Address mode → `setActiveLocation({ lat, lon, timestamp })`
2. MapView effect (lines 648-673) triggers on `activeLocation` change
3. `drawActiveBox(lat, lon)` is called:
   - Calculates grid bounds using `getGridBounds()`
   - Adds MapLibre GeoJSON source + fill layer (blue fill 25% opacity)
   - Calls `setActiveBoxBounds(bounds)` to update SVG overlay state
4. `MarchingAntsOverlay` receives new bounds → recalculates screen position
5. SVG `<rect>` with `.marching-ants` class animates via CSS

### Z-Index Layering

| Layer | Z-Index | Description |
|-------|---------|-------------|
| OSM Base Map | 0 | OpenStreetMap tiles |
| Plus Code Grid | 1 | White grid overlay (70% opacity) |
| Restriction Overlay | 5 | Black 35% dim outside clickable zone |
| Active Box Fill | 10 | Blue fill (#1E90FF, 25% opacity) |
| Neighbor Boxes | 15 | Green fill (#90EE90, 25% opacity) |
| Marching Ants SVG | 20 | Animated border overlay |

---

## 3. Map Visualization: Plus Code Grid Overlay

The Plus Code grid is displayed as a raster tile layer.

### Grid Source Configuration

**File:** `src/components/map/MapView.tsx` (lines 516-544)

```typescript
map.current.addSource('pluscode-grid', {
  type: 'raster',
  tiles: ['https://grid.plus.codes/grid/tms/{z}/{x}/{y}.png?col=white'],
  tileSize: 256,
  scheme: 'tms'
});

map.current.addLayer({
  id: 'pluscode-grid-layer',
  type: 'raster',
  source: 'pluscode-grid',
  paint: { 'raster-opacity': 0 }  // Start hidden
});
```

### Visibility Control

```typescript
const shouldShow = gridVisible && zoom >= ZOOM_THRESHOLD;
map.current.setPaintProperty('pluscode-grid-layer', 'raster-opacity', shouldShow ? 0.7 : 0);
```

---

## 4. Map Visualization: Active Location Box (Blue Fill)

### MapLibre Layer Configuration

**File:** `src/components/map/MapView.tsx` (lines 563-627)

```typescript
const drawActiveBox = useCallback((lat: number, lon: number) => {
  const id = 'active-grid-box';
  const bounds = getGridBounds(lat, lon);
  
  // Add GeoJSON source with polygon geometry
  map.current.addSource(id, {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [bounds.sw[1], bounds.sw[0]],  // SW
          [bounds.ne[1], bounds.sw[0]],  // SE
          [bounds.ne[1], bounds.ne[0]],  // NE
          [bounds.sw[1], bounds.ne[0]],  // NW
          [bounds.sw[1], bounds.sw[0]]   // Close polygon
        ]]
      }
    }
  });

  // Fill layer: 25% opacity Dodger Blue
  map.current.addLayer({
    id: id,
    type: 'fill',
    source: id,
    paint: {
      'fill-color': '#1E90FF',
      'fill-opacity': 0.25
    }
  });
  
  setActiveBoxBounds(bounds);  // Trigger marching ants SVG overlay
}, []);
```

---

## 5. Map Visualization: 8 Neighbor Boxes (Green)

For `basic_user` role, display light green on 8 neighbor boxes to GPS location.

### Component

**File:** `src/components/map/NeighborBoxesLayer.tsx`

### Neighbor Calculation

**Function:** `getNeighborGrids(lat, lon)` in `src/lib/pluscode.ts`

```typescript
export function getNeighborGrids(lat: number, lon: number): GridBounds[] {
  const gridSize = 0.000125;
  const offsets = [
    [1, 0],   // N   (North)
    [1, 1],   // NE  (Northeast)
    [0, 1],   // E   (East)
    [-1, 1],  // SE  (Southeast)
    [-1, 0],  // S   (South)
    [-1, -1], // SW  (Southwest)
    [0, -1],  // W   (West)
    [1, -1],  // NW  (Northwest)
  ];
  // Returns array of 8 GridBounds objects
}
```

### Layer Styling

```typescript
// Fill: 25% opacity light green
paint: { 'fill-color': '#90EE90', 'fill-opacity': 0.25 }

// Border: 2px lime green
paint: { 'line-color': '#32CD32', 'line-width': 2 }
```

### Hover Tooltip

Text: "Click if your address is in this area."

### Active Location Exclusion

```typescript
// Skip neighbor if it matches activeLocation cell
if (activeLocation && isSameGridCell(centerLat, centerLon, activeLocation.lat, activeLocation.lon)) {
  return;  // Skip drawing this box (shows 7 boxes instead of 8)
}
```

---

## 6. Map Visualization: GPS Breadcrumb (Light Blue)

When user clicks a neighbor box, a light blue box appears at original GPS location.

### Component

**File:** `src/components/map/GPSLocationLayer.tsx`

### Layer Styling

```typescript
// Fill: 40% opacity light periwinkle
paint: { 'fill-color': '#8080FF', 'fill-opacity': 0.4 }

// Border: 2px solid
paint: { 'line-color': '#8080FF', 'line-width': 2 }
```

### Visibility Logic

```typescript
const shouldRender = visible && showBreadcrumb;
// showBreadcrumb = true when activeLocation differs from userLocation
```

---

## 7. Click Restrictions by Role

User should ONLY BE ABLE TO CLICK ON ANY OF THE 8 NEIGHBORING PLUS CODE BOXES on the map.

### Role Detection

**Hook:** `useEffectiveRole()` returns `isLocationRestricted: true` for `basic_user`

### Click Validation

**File:** `src/components/map/MapView.tsx` (lines 492-505)

```typescript
if (isLocationRestricted && userLocation) {
  if (!isInNeighborhood(lat, lon, userLocation.lat, userLocation.lon)) {
    toast.warning('Location Restricted', {
      description: 'Your role allows creating addresses only in your location or neighboring cells.',
      duration: 4000,
    });
    return;  // Block the click
  }
}
```

### Neighborhood Validation

**Function:** `isInNeighborhood()` in `src/lib/pluscode.ts`

```typescript
export function isInNeighborhood(clickLat, clickLon, centerLat, centerLon): boolean {
  const gridSize = 0.000125;
  const latDiff = Math.abs(clickBounds.sw[0] - centerBounds.sw[0]);
  const lonDiff = Math.abs(clickBounds.sw[1] - centerBounds.sw[1]);
  return latDiff <= gridSize * 1.1 && lonDiff <= gridSize * 1.1;  // 9-cell neighborhood
}
```

### Restriction Overlay

- Black 35% opacity overlay dims areas outside clickable zone
- SVG clip path creates "hole" over the 9-cell neighborhood

---

## 8. Clicking a Neighbor Box

When a `basic_user` clicks one of the 8 green neighbor boxes:

- **Update `activeLocation`** to center of clicked cell
- **Set `activeLocationSource: 'map_click'`** (not GPS)
- **DO NOT fly the map** - all 9 cells visible at zoom 18
- **Remove clicked cell from green display** (7 boxes visible)
- **Show GPS breadcrumb** on original GPS cell (light blue)
- **Move marching ants** to newly clicked cell
- **Perform `checkLocation()`** on new coordinates
- **Open sidebar** with results

---

## 9. Technical Constants

### Sizes & Zoom

| Constant | Value |
|----------|-------|
| Plus Code Grid Size | `0.000125°` (~14m x 14m) |
| Address Mode Zoom | 18 |
| Grid Min Zoom | 8 |
| Grid Opacity | 70% |
| Fly-To Duration | 1000ms |

### Colors

| Element | Color | Opacity |
|---------|-------|---------|
| Marching Ants Border | `#0000EE` | 100%, 3px |
| Marching Ants Dash | 8-4 pattern | - |
| Active Box Fill | `#1E90FF` | 25% |
| Neighbor Box Fill | `#90EE90` | 25% |
| Neighbor Box Border | `#32CD32` | 100%, 2px |
| GPS Breadcrumb | `#8080FF` | 40% |
| Restriction Overlay | `#000000` | 35% |

### Animation

| Name | Duration | Effect |
|------|----------|--------|
| marching-ants-box | 1s linear infinite | dashoffset: 0 → -12 (clockwise) |

---

## 10. File References

| Component | File |
|-----------|------|
| Mode Toggle | `src/components/map/ModeToggle.tsx` |
| Address Mode Entry | `src/hooks/useAddressModeEntry.ts` |
| Map Store | `src/store/mapStore.ts` |
| MapView + SVG Overlays | `src/components/map/MapView.tsx` |
| Neighbor Boxes | `src/components/map/NeighborBoxesLayer.tsx` |
| GPS Breadcrumb | `src/components/map/GPSLocationLayer.tsx` |
| Plus Code Utils | `src/lib/pluscode.ts` |
| CSS Animations | `src/index.css` (lines 210-237) |
| Address Check | `src/lib/checkLocationAddress.ts` |
