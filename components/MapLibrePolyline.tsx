/**
 * MapLibre Polyline Component
 * 
 * Adapter component to provide react-native-maps-like Polyline API
 * Uses MapLibre's ShapeSource and LineLayer internally
 */

import React from 'react';
import { ShapeSource, LineLayer } from '@maplibre/maplibre-react-native';

interface MapLibrePolylineProps {
  coordinates: Array<{
    latitude: number;
    longitude: number;
  }>;
  strokeColor?: string;
  strokeWidth?: number;
  lineCap?: 'round' | 'butt' | 'square';
  lineJoin?: 'round' | 'miter' | 'bevel';
}

/**
 * Polyline component compatible with react-native-maps Polyline API
 * Uses MapLibre ShapeSource and LineLayer internally
 */
export const MapLibrePolyline: React.FC<MapLibrePolylineProps> = ({
  coordinates,
  strokeColor = '#0000FF',
  strokeWidth = 6,
  lineCap = 'round',
  lineJoin = 'round',
}) => {
  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  // Convert coordinates to GeoJSON LineString
  const lineStringGeoJSON = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: coordinates.map(coord => [coord.longitude, coord.latitude]),
        },
        properties: {},
      },
    ],
  };

  return (
    <ShapeSource id={`polyline-${coordinates[0].latitude}-${coordinates[0].longitude}`} shape={lineStringGeoJSON}>
      <LineLayer
        id={`polyline-layer-${coordinates[0].latitude}-${coordinates[0].longitude}`}
        style={{
          lineColor: strokeColor,
          lineWidth: strokeWidth,
          lineCap: lineCap,
          lineJoin: lineJoin,
          lineOpacity: 1,
        }}
      />
    </ShapeSource>
  );
};
