/**
 * GPSLocationLayer
 *
 * Renders the GPS location as a light blue grid cell (breadcrumb) with pulsing fill
 * when userLocation is set and activeLocation is in a different grid cell.
 * See docs/PLUSCODE_ANIMATION_DISPLAY_SPEC.md (State 2: pulsing on GPS when active ≠ GPS).
 * When active = GPS, this layer is not shown (no breadcrumb).
 *
 * Phase 5: Map visualization — offline first.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { ShapeSource, FillLayer, LineLayer } from '@maplibre/maplibre-react-native';
import { useMapStore } from '@/lib/store/mapStore';
import { getGridBounds, gridBoundsToPolygon, isSameGridCell } from '@/utils/plusCodeGrid';

const GPS_BREADCRUMB_FILL_COLOR = '#8080FF';
const GPS_BREADCRUMB_FILL_OPACITY = 0.4;
const GPS_BREADCRUMB_LINE_WIDTH = 2;

export interface GPSLocationLayerProps {
  /** When true, only show GPS breadcrumb when activeLocation !== userLocation (GPS not selected). */
  showOnlyWhenOffset?: boolean;
  /** When true, only show when isLocationRestricted AND active !== user (web parity: breadcrumb only for basic_user). */
  showOnlyWhenRestrictedAndOffset?: boolean;
  isLocationRestricted?: boolean;
}

export function GPSLocationLayer({
  showOnlyWhenOffset = false,
  showOnlyWhenRestrictedAndOffset = false,
  isLocationRestricted = false,
}: GPSLocationLayerProps) {
  const userLocation = useMapStore((s) => s.userLocation);
  const activeLocation = useMapStore((s) => s.activeLocation);
  const [gpsFillOpacity, setGpsFillOpacity] = useState(GPS_BREADCRUMB_FILL_OPACITY);

  const shouldShow = useMemo(() => {
    if (!userLocation) return false;
    if (showOnlyWhenRestrictedAndOffset && !isLocationRestricted) return false;
    if (!showOnlyWhenOffset && !showOnlyWhenRestrictedAndOffset) return true;
    if (!activeLocation) return true;
    const same = isSameGridCell(
      activeLocation.latitude,
      activeLocation.longitude,
      userLocation.latitude,
      userLocation.longitude,
    );
    return !same;
  }, [userLocation, activeLocation, showOnlyWhenOffset, showOnlyWhenRestrictedAndOffset, isLocationRestricted]);

  const geoJSON = useMemo(() => {
    if (!shouldShow || !userLocation) return null;
    const bounds = getGridBounds(userLocation.latitude, userLocation.longitude);
    const polygon = gridBoundsToPolygon(bounds);
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [polygon],
          },
          properties: {},
        },
      ],
    };
  }, [shouldShow, userLocation]);

  // Pulsing animation for GPS location when it differs from active location
  useEffect(() => {
    if (!shouldShow) return;

    let fillPhase = 0;
    const fillMs = 80;

    const interval = setInterval(() => {
      fillPhase = (fillPhase + 0.04) % 1;
      setGpsFillOpacity(GPS_BREADCRUMB_FILL_OPACITY + 0.15 * Math.sin(fillPhase * 2 * Math.PI));
    }, fillMs);

    return () => clearInterval(interval);
  }, [shouldShow]);

  if (!geoJSON) return null;

  return (
    <ShapeSource id="gps-breadcrumb-source" shape={geoJSON}>
      <FillLayer
        id="gps-breadcrumb-fill"
        style={{
          fillColor: GPS_BREADCRUMB_FILL_COLOR,
          fillOpacity: gpsFillOpacity,
        }}
      />
      <LineLayer
        id="gps-breadcrumb-outline"
        style={{
          lineColor: GPS_BREADCRUMB_FILL_COLOR,
          lineWidth: GPS_BREADCRUMB_LINE_WIDTH,
          lineOpacity: 1,
        }}
      />
    </ShapeSource>
  );
}

export default GPSLocationLayer;
