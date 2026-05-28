/**
 * NearbyStreetsLayer
 *
 * Renders alternate/corner streets from store (nearbyStreets) with distinct colors.
 * Data from store only; no network. Excludes the active street.
 *
 * Phase 5: Map visualization — offline first.
 */

import React, { useMemo } from 'react';
import { ShapeSource, LineLayer } from '@maplibre/maplibre-react-native';
import { useStreetSelectionStore } from '@/lib/store/streetSelectionStore';
import { ALTERNATE_STREET_COLORS } from '@/lib/streetColors';
import type { ActiveStreetData } from '@/lib/streetSelection';

const STREET_WIDTH = 4;
const MAX_ALTERNATES = 4;

/** Build GeoJSON FeatureCollection for a single LineString (coordinates already [lon, lat][]) */
function lineToGeoJSON(coords: [number, number][]): GeoJSON.FeatureCollection | null {
  if (!coords || coords.length < 2) return null;
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      },
    ],
  };
}

export function NearbyStreetsLayer() {
  const nearbyStreets = useStreetSelectionStore((s) => s.nearbyStreets);
  const activeStreetData = useStreetSelectionStore((s) => s.activeStreetData);

  const alternateStreets = useMemo(() => {
    const filtered = nearbyStreets.filter(
      (s: ActiveStreetData) => s.segment_id !== activeStreetData?.segment_id
    );
    return filtered.slice(0, MAX_ALTERNATES);
  }, [nearbyStreets, activeStreetData?.segment_id]);

  if (alternateStreets.length === 0) return null;

  return (
    <>
      {alternateStreets.map((street, index) => {
        const geoJSON = lineToGeoJSON(street.geometry);
        if (!geoJSON) return null;
        const color = ALTERNATE_STREET_COLORS[index % ALTERNATE_STREET_COLORS.length];
        const sourceId = `nearby-street-${street.segment_id}`;
        const outlineId = `${sourceId}-outline`;
        const lineId = `${sourceId}-line`;
        return (
          <ShapeSource key={street.segment_id} id={sourceId} shape={geoJSON}>
            <LineLayer
              id={outlineId}
              style={{
                lineColor: '#ffffff',
                lineWidth: STREET_WIDTH + 4,
                lineOpacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <LineLayer
              id={lineId}
              style={{
                lineColor: color,
                lineWidth: STREET_WIDTH,
                lineOpacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        );
      })}
    </>
  );
}

export default NearbyStreetsLayer;
