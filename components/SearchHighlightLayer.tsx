/**
 * SearchHighlightLayer
 *
 * Renders a highlighted street geometry from local search (e.g. street_segments by name).
 * Data from store (searchHighlight); set via setSearchHighlight when search returns a result.
 * Offline only.
 *
 * Phase 5: Map visualization — offline first.
 */

import React, { useMemo } from 'react';
import { ShapeSource, LineLayer } from '@maplibre/maplibre-react-native';
import { useMapStore } from '@/lib/store/mapStore';

const HIGHLIGHT_WIDTH = 5;
const HIGHLIGHT_COLOR = '#FF6B00'; // Orange highlight
const HIGHLIGHT_OUTLINE_WIDTH = HIGHLIGHT_WIDTH + 4;

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

export function SearchHighlightLayer() {
  const searchHighlight = useMapStore((s) => s.searchHighlight);

  const geoJSON = useMemo(() => {
    if (!searchHighlight?.geometry?.length) return null;
    return lineToGeoJSON(searchHighlight.geometry);
  }, [searchHighlight?.geometry]);

  if (!geoJSON) return null;

  return (
    <ShapeSource id="search-highlight-source" shape={geoJSON}>
      <LineLayer
        id="search-highlight-outline"
        style={{
          lineColor: '#ffffff',
          lineWidth: HIGHLIGHT_OUTLINE_WIDTH,
          lineOpacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      <LineLayer
        id="search-highlight-line"
        style={{
          lineColor: HIGHLIGHT_COLOR,
          lineWidth: HIGHLIGHT_WIDTH,
          lineOpacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </ShapeSource>
  );
}

export default SearchHighlightLayer;
