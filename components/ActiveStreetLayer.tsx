/**
 * ActiveStreetLayer
 *
 * Renders the active street line (marching ants), start/end markers, lock badge.
 * Data from store (resolvedStreetGeometry, activeStreetDirectionLock). Offline only.
 *
 * Phase 5: Map visualization — offline first.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShapeSource, LineLayer } from '@maplibre/maplibre-react-native';
import { PointAnnotation } from '@maplibre/maplibre-react-native';
import { useMapStore } from '@/lib/store/mapStore';
import { ACTIVE_STREET_COLOR, START_MARKER_COLOR, END_MARKER_COLOR, LOCK_INDICATOR_COLOR } from '@/lib/streetColors';

const STREET_WIDTH = 4;
const MARCH_ANT_MS = 1000;

/** Convert [lat, lon][] (resolved geometry) to GeoJSON LineString coordinates [lon, lat][] */
function geometryToGeoJSONCoords(geometry: [number, number][]): [number, number][] {
  return geometry.map(([lat, lon]) => [lon, lat]);
}

export function ActiveStreetLayer() {
  const resolvedStreetGeometry = useMapStore((s) => s.resolvedStreetGeometry);
  const activeStreetDirectionLock = useMapStore((s) => s.activeStreetDirectionLock);
  const [dashPhase, setDashPhase] = useState(0);

  const isLocked = activeStreetDirectionLock?.directionState === 'locked';
  const lockedDirection = activeStreetDirectionLock?.lockedDirection ?? null;

  useEffect(() => {
    if (!resolvedStreetGeometry?.geometry?.length) return;
    const interval = setInterval(() => {
      setDashPhase((p) => (p + 0.05) % 1);
    }, (MARCH_ANT_MS * 0.05) | 0);
    return () => clearInterval(interval);
  }, [resolvedStreetGeometry?.geometry?.length]);

  const lineGeoJSON = useMemo(() => {
    if (!resolvedStreetGeometry?.geometry || resolvedStreetGeometry.geometry.length < 2) return null;
    const coords = geometryToGeoJSONCoords(resolvedStreetGeometry.geometry);
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: coords },
          properties: {},
        },
      ],
    };
  }, [resolvedStreetGeometry?.geometry]);

  const startPoint = resolvedStreetGeometry?.start;
  const endPoint = resolvedStreetGeometry?.end;
  const midPoint = useMemo(() => {
    const geom = resolvedStreetGeometry?.geometry;
    if (!geom || geom.length < 2) return null;
    const i = Math.floor(geom.length * 0.4);
    return geom[i];
  }, [resolvedStreetGeometry?.geometry]);

  if (!lineGeoJSON) return null;

  const dashLen = 12;
  const gapLen = 6;
  const marchingDash = [Math.max(0.5, dashLen * (1 - dashPhase)), gapLen + dashLen * dashPhase];

  return (
    <>
      <ShapeSource id="active-street-line" shape={lineGeoJSON}>
        <LineLayer
          id="active-street-line-outline"
          style={{
            lineColor: '#ffffff',
            lineWidth: STREET_WIDTH + 4,
            lineOpacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
        <LineLayer
          id="active-street-line-marching"
          style={{
            lineColor: ACTIVE_STREET_COLOR,
            lineWidth: STREET_WIDTH,
            lineOpacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
            lineDasharray: marchingDash,
          }}
        />
      </ShapeSource>
      {startPoint && (
        <PointAnnotation
          id="active-street-start"
          coordinate={[startPoint[1], startPoint[0]]}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={[styles.marker, styles.startMarker]} />
        </PointAnnotation>
      )}
      {endPoint && (
        <PointAnnotation
          id="active-street-end"
          coordinate={[endPoint[1], endPoint[0]]}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={[styles.marker, styles.endMarker]} />
        </PointAnnotation>
      )}
      {isLocked && midPoint && (
        <PointAnnotation
          id="active-street-lock-badge"
          coordinate={[midPoint[1], midPoint[0]]}
          anchor={{ x: 0.5, y: 1 }}
        >
          <View style={styles.lockBadge}>
            <Text style={styles.lockText}>{lockedDirection === 'reversed' ? 'LOCKED ↻' : 'LOCKED'}</Text>
          </View>
        </PointAnnotation>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#fff',
  },
  startMarker: {
    backgroundColor: START_MARKER_COLOR,
  },
  endMarker: {
    backgroundColor: END_MARKER_COLOR,
  },
  lockBadge: {
    backgroundColor: LOCK_INDICATOR_COLOR,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lockText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default ActiveStreetLayer;
