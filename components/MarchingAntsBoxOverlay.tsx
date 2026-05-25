/**
 * MarchingAntsBoxOverlay
 *
 * Renders the Plus Code active cell as an SVG rectangle with marching ants
 * in screen space (matches web MapView MarchingAntsOverlay).
 * Uses getPointInView to project bounds to view coordinates and Reanimated
 * for strokeDashoffset animation (1s cycle, 8-4 pattern).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export interface MarchingAntsBoxOverlayProps {
  /** Project [lng, lat] to [x, y] in view coordinates */
  getPointInView: (coordinate: [number, number]) => Promise<[number, number]>;
  /** Bounds of the active cell (sw and ne corners). [lon, lat] per GeoJSON. */
  bounds: { sw: [number, number]; ne: [number, number] } | null;
  /** Increment when map region changes so we re-project */
  regionRevision?: number;
}

export function MarchingAntsBoxOverlay({
  getPointInView,
  bounds,
  regionRevision = 0,
}: MarchingAntsBoxOverlayProps) {
  const [rect, setRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const strokeDashoffset = useSharedValue(0);

  const updateRect = useCallback(async () => {
    if (!bounds) {
      setRect(null);
      return;
    }
    try {
      // bounds.sw, bounds.ne are [lng, lat]
      const [swX, swY] = await getPointInView(bounds.sw);
      const [neX, neY] = await getPointInView(bounds.ne);
      setRect({
        x: Math.min(swX, neX),
        y: Math.min(swY, neY),
        width: Math.abs(neX - swX),
        height: Math.abs(neY - swY),
      });
    } catch {
      setRect(null);
    }
  }, [bounds, getPointInView]);

  useEffect(() => {
    updateRect();
  }, [updateRect, regionRevision]);

  // Match web: 1s linear infinite, stroke-dashoffset 0 → -12, strokeDasharray 8 4
  useEffect(() => {
    strokeDashoffset.value = 0;
    strokeDashoffset.value = withRepeat(
      withTiming(-12, { duration: 1000 }),
      -1,
      false
    );
  }, [strokeDashoffset]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: strokeDashoffset.value,
  }));

  if (!rect) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <AnimatedRect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          fill="none"
          stroke="#0000EE"
          strokeWidth={3}
          strokeDasharray="8 4"
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
}
