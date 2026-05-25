/**
 * MarchingAntsStreetOverlay
 *
 * Renders the active street with marching ants in screen space (matches web
 * ActiveStreetLayer MarchingAntsStreetOverlay). Uses getPointInView to project
 * geometry to view coordinates. Uses JS-driven strokeDashoffset (setInterval)
 * because useAnimatedProps + react-native-svg Path has known issues with
 * strokeDashoffset; the Plus Code box (Rect) works with Reanimated.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, G, Rect, Text } from 'react-native-svg';
import {
  ACTIVE_STREET_COLOR,
  START_MARKER_COLOR,
  END_MARKER_COLOR,
  LOCK_INDICATOR_COLOR,
} from '@/lib/streetColors';

const STREET_WIDTH = 4;
const OUTLINE_WIDTH = STREET_WIDTH + 4;
const DASH_LEN = 12;
const GAP_LEN = 6;
const CYCLE_MS = 800;
const TICK_MS = 50;

export interface MarchingAntsStreetOverlayProps {
  /** Project [lng, lat] to [x, y] in view coordinates */
  getPointInView: (coordinate: [number, number]) => Promise<[number, number]>;
  /** Street geometry [lon, lat][] */
  geometry: [number, number][] | null;
  isLocked: boolean;
  lockedDirection: string | null;
  /** Increment when map region changes so we re-project */
  regionRevision?: number;
}

export function MarchingAntsStreetOverlay({
  getPointInView,
  geometry,
  isLocked,
  lockedDirection,
  regionRevision = 0,
}: MarchingAntsStreetOverlayProps) {
  const [pathData, setPathData] = useState('');
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
  const [midPoint, setMidPoint] = useState<{ x: number; y: number } | null>(null);
  // Phase 0→1 over 800ms: we animate dasharray (not offset) so the dash appears to march along the path (same as web effect; react-native-svg strokeDashoffset doesn't slide the pattern like CSS).
  const [dashPhase, setDashPhase] = useState(0);

  const updatePath = useCallback(async () => {
    if (!geometry || geometry.length < 2) {
      setPathData('');
      setStartPoint(null);
      setEndPoint(null);
      setMidPoint(null);
      return;
    }
    try {
      const points: { x: number; y: number }[] = [];
      for (const [lon, lat] of geometry) {
        const [x, y] = await getPointInView([lon, lat]);
        points.push({ x, y });
      }
      const path = `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`;
      setPathData(path);
      setStartPoint(points[0]);
      setEndPoint(points[points.length - 1]);
      const midIndex = Math.floor(points.length * 0.4);
      setMidPoint(points[midIndex] ?? points[0]);
    } catch {
      setPathData('');
      setStartPoint(null);
      setEndPoint(null);
      setMidPoint(null);
    }
  }, [geometry, getPointInView]);

  useEffect(() => {
    updatePath();
  }, [updatePath, regionRevision]);

  // Match web: ants marching infinitely along the path. Animate dasharray so the visible dash slides: [12*(1-phase), 6+12*phase] (same illusion as web's stroke-dashoffset 0→-18).
  useEffect(() => {
    let phase = 0;
    const step = TICK_MS / CYCLE_MS;
    const interval = setInterval(() => {
      phase = (phase + step) % 1;
      setDashPhase(phase);
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  if (!pathData) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        {/* White outline */}
        <Path
          d={pathData}
          fill="none"
          stroke="white"
          strokeWidth={OUTLINE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
        {/* Marching ants line: dasharray cycle makes the dash appear to march along the path (same visual as web) */}
        <Path
          d={pathData}
          fill="none"
          stroke={ACTIVE_STREET_COLOR}
          strokeWidth={STREET_WIDTH}
          strokeDasharray={`${Math.max(0.5, DASH_LEN * (1 - dashPhase))} ${GAP_LEN + DASH_LEN * dashPhase}`}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Lock badge at ~40% */}
        {isLocked && midPoint && (
          <G
            x={midPoint.x - 40}
            y={midPoint.y - 35}
            fill={LOCK_INDICATOR_COLOR}
            opacity={0.95}>
            <Rect width={80} height={22} rx={11} />
            <Text
              x={40}
              y={14}
              fill="white"
              fontSize={10}
              fontWeight="600"
              textAnchor="middle">
              {lockedDirection === 'reversed' ? 'LOCKED ↻' : 'LOCKED'}
            </Text>
          </G>
        )}
        {/* Start circle (green) */}
        {startPoint && (
          <>
            <Circle
              cx={startPoint.x}
              cy={startPoint.y}
              r={8}
              fill="white"
              stroke={START_MARKER_COLOR}
              strokeWidth={3}
            />
            <Circle cx={startPoint.x} cy={startPoint.y} r={4} fill={START_MARKER_COLOR} />
          </>
        )}
        {/* End circle (red) */}
        {endPoint && (
          <>
            <Circle
              cx={endPoint.x}
              cy={endPoint.y}
              r={8}
              fill="white"
              stroke={END_MARKER_COLOR}
              strokeWidth={3}
            />
            <Circle cx={endPoint.x} cy={endPoint.y} r={4} fill={END_MARKER_COLOR} />
          </>
        )}
      </Svg>
    </View>
  );
}
