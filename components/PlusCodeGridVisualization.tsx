/**
 * Plus Code Grid Visualization Component
 * 
 * Renders the 3x3 grid visualization with:
 * - Center square with blue fill and marching ants border
 * - 8 neighbor squares with light green fill
 * 
 * Matches web implementation behavior
 */

import React, { useMemo } from 'react';
import { ShapeSource, FillLayer, LineLayer } from '@maplibre/maplibre-react-native';
import { getGridBounds, getNeighborGrids, gridBoundsToPolygon, type GridBounds } from '@/utils/plusCodeGrid';

interface PlusCodeGridVisualizationProps {
  centerLat: number;
  centerLon: number;
  showNeighbors?: boolean;
}

/**
 * Plus Code Grid Visualization
 * 
 * Renders center square (blue fill + marching ants border) and 8 neighbor squares (green fill)
 */
export const PlusCodeGridVisualization: React.FC<PlusCodeGridVisualizationProps> = ({
  centerLat,
  centerLon,
  showNeighbors = true,
}) => {
  // Debug logging
  React.useEffect(() => {
    console.log('[PlusCodeGridVisualization] Rendering with:', {
      centerLat,
      centerLon,
      showNeighbors,
    });
  }, [centerLat, centerLon, showNeighbors]);

  // Calculate grid bounds
  const centerBounds = useMemo(() => {
    const bounds = getGridBounds(centerLat, centerLon);
    console.log('[PlusCodeGridVisualization] Center bounds:', bounds);
    return bounds;
  }, [centerLat, centerLon]);
  
  const neighborBounds = useMemo(() => {
    if (!showNeighbors) return [];
    const bounds = getNeighborGrids(centerLat, centerLon);
    console.log('[PlusCodeGridVisualization] Neighbor bounds count:', bounds.length);
    return bounds;
  }, [centerLat, centerLon, showNeighbors]);

  // Center square GeoJSON (blue fill)
  const centerSquareGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [gridBoundsToPolygon(centerBounds)],
        },
        properties: {},
      },
    ],
  }), [centerBounds]);

  // Neighbor squares GeoJSON (green fill)
  const neighborSquaresGeoJSON = useMemo(() => {
    if (!showNeighbors || neighborBounds.length === 0) return null;
    
    return {
      type: 'FeatureCollection' as const,
      features: neighborBounds.map((bounds, index) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [gridBoundsToPolygon(bounds)],
        },
        properties: { index },
      })),
    };
  }, [neighborBounds, showNeighbors]);

  return (
    <>
      {/* Center Square - Blue Fill */}
      <ShapeSource id="center-grid-square" shape={centerSquareGeoJSON}>
        <FillLayer
          id="center-grid-square-fill"
          style={{
            fillColor: '#1E90FF',
            fillOpacity: 0.25,
          }}
        />
        {/* Dashed border (marching ants effect - static for now, can be enhanced with SVG overlay later) */}
        <LineLayer
          id="center-grid-square-border"
          style={{
            lineColor: '#0000EE',
            lineWidth: 3,
            lineOpacity: 1,
            lineDasharray: [8, 4], // Dashed pattern: 8px dash, 4px gap
          }}
        />
      </ShapeSource>

      {/* Neighbor Squares - Green Fill */}
      {neighborSquaresGeoJSON && (
        <ShapeSource id="neighbor-grid-squares" shape={neighborSquaresGeoJSON}>
          <FillLayer
            id="neighbor-grid-squares-fill"
            style={{
              fillColor: '#90EE90',
              fillOpacity: 0.3,
            }}
          />
          <LineLayer
            id="neighbor-grid-squares-border"
            style={{
              lineColor: '#90EE90',
              lineWidth: 1,
              lineOpacity: 0.5,
            }}
          />
        </ShapeSource>
      )}
    </>
  );
};
