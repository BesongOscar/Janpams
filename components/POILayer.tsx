import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShapeSource, SymbolLayer, CircleLayer } from '@maplibre/maplibre-react-native';
import { getByPackId } from '@/lib/db/pois';
import type { POIRecord } from '@/lib/db/schemas';

interface POILayerProps {
  packIds: string[];
  visible?: boolean;
  onPoiPress?: (poi: POIRecord) => void;
}

const TIER_STYLES: Record<number, { radius: number; color: string; opacity: number }> = {
  1: { radius: 8, color: '#EF4444', opacity: 0.95 },
  2: { radius: 6, color: '#F97316', opacity: 0.85 },
  3: { radius: 4, color: '#3B82F6', opacity: 0.75 },
};

const DEFAULT_TIER_STYLE = { radius: 3, color: '#6B7280', opacity: 0.6 };

export const POILayer: React.FC<POILayerProps> = ({
  packIds,
  visible = true,
  onPoiPress,
}) => {
  const [pois, setPois] = useState<POIRecord[]>([]);

  useEffect(() => {
    if (!visible || packIds.length === 0) {
      setPois([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const allPois: POIRecord[] = [];
      for (const packId of packIds) {
        try {
          const packPois = await getByPackId(packId);
          allPois.push(...packPois);
        } catch (err) {
          console.warn(`[POILayer] Failed to load POIs for pack ${packId}:`, err);
        }
      }
      if (!cancelled) setPois(allPois);
    })();

    return () => { cancelled = true; };
  }, [packIds, visible]);

  const geojson = useMemo(() => {
    if (pois.length === 0) return null;
    return {
      type: 'FeatureCollection' as const,
      features: pois.map(poi => ({
        type: 'Feature' as const,
        id: poi.id,
        geometry: {
          type: 'Point' as const,
          coordinates: [poi.lon, poi.lat],
        },
        properties: {
          id: poi.id,
          name: poi.name || '',
          category: poi.category,
          subcategory: poi.subcategory,
          tier: poi.tier,
        },
      })),
    };
  }, [pois]);

  if (!visible || !geojson) return null;

  return (
    <ShapeSource
      id="poi-source"
      shape={geojson}
      onPress={(e) => {
        if (!onPoiPress || !e.features?.[0]) return;
        const feature = e.features[0];
        const id = feature.properties?.id;
        const poi = pois.find(p => p.id === id);
        if (poi) onPoiPress(poi);
      }}
    >
      {/* Tier 1 — large, prominent */}
      <CircleLayer
        id="poi-tier1"
        filter={['==', ['get', 'tier'], 1]}
        style={{
          circleRadius: TIER_STYLES[1].radius,
          circleColor: TIER_STYLES[1].color,
          circleOpacity: TIER_STYLES[1].opacity,
          circleStrokeWidth: 1.5,
          circleStrokeColor: '#fff',
        }}
      />
      {/* Tier 2 — medium */}
      <CircleLayer
        id="poi-tier2"
        filter={['==', ['get', 'tier'], 2]}
        style={{
          circleRadius: TIER_STYLES[2].radius,
          circleColor: TIER_STYLES[2].color,
          circleOpacity: TIER_STYLES[2].opacity,
          circleStrokeWidth: 1,
          circleStrokeColor: '#fff',
        }}
      />
      {/* Tier 3+ — small */}
      <CircleLayer
        id="poi-tier3"
        filter={['>=', ['get', 'tier'], 3]}
        style={{
          circleRadius: DEFAULT_TIER_STYLE.radius,
          circleColor: DEFAULT_TIER_STYLE.color,
          circleOpacity: DEFAULT_TIER_STYLE.opacity,
          circleStrokeWidth: 0.5,
          circleStrokeColor: '#fff',
        }}
      />
      {/* Labels for tier 1 */}
      <SymbolLayer
        id="poi-labels"
        filter={['==', ['get', 'tier'], 1]}
        style={{
          textField: ['get', 'name'],
          textSize: 11,
          textColor: '#1F2937',
          textHaloColor: '#fff',
          textHaloWidth: 1,
          textOffset: [0, 1.2],
          textAnchor: 'top',
          textMaxWidth: 8,
        }}
      />
    </ShapeSource>
  );
};

export default POILayer;
