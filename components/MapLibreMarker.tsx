/**
 * MapLibre Marker Component
 * 
 * Adapter component to provide react-native-maps-like Marker API
 * Uses MapLibre's PointAnnotation internally
 */

import React from 'react';
import { PointAnnotation } from '@maplibre/maplibre-react-native';
import { View, Text } from 'react-native';

interface MapLibreMarkerProps {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  title?: string;
  pinColor?: string;
  draggable?: boolean;
  onPress?: () => void;
  onDragEnd?: (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => void;
  children?: React.ReactNode;
  anchor?: { x: number; y: number };
  tappable?: boolean;
  tracksViewChanges?: boolean;
}

/**
 * Marker component compatible with react-native-maps Marker API
 * Uses MapLibre PointAnnotation internally
 */
export const MapLibreMarker: React.FC<MapLibreMarkerProps> = ({
  coordinate,
  title,
  pinColor = '#0000FF',
  draggable = false,
  onPress,
  onDragEnd,
  children,
  anchor,
  tappable = true,
  tracksViewChanges = false,
}) => {
  const handleSelected = () => {
    if (onPress) {
      onPress();
    }
  };

  const handleDragEnd = (payload: any) => {
    if (onDragEnd && payload.geometry?.coordinates) {
      const [longitude, latitude] = payload.geometry.coordinates;
      onDragEnd({
        nativeEvent: {
          coordinate: {
            latitude,
            longitude,
          },
        },
      });
    }
  };

  // Default pin view if no children provided
  const markerContent = children || (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: pinColor,
        borderWidth: 2,
        borderColor: '#FFFFFF',
      }}
    />
  );

  // PointAnnotation must have exactly one child view. MapLibre's Callout counts as a second
  // native child and causes "Trying to remove a view index above child count" on unmount.
  // So we use a single wrapper View and show title as plain Text inside it when needed.
  return (
    <PointAnnotation
      id={`marker-${coordinate.latitude}-${coordinate.longitude}`}
      coordinate={[coordinate.longitude, coordinate.latitude]}
      title={title}
      draggable={draggable}
      onSelected={tappable ? handleSelected : undefined}
      onDragEnd={draggable ? handleDragEnd : undefined}
      anchor={anchor ? { x: anchor.x, y: anchor.y } : undefined}
    >
      <View pointerEvents="box-none" style={{ alignItems: 'center' }}>
        {markerContent}
        {title ? (
          <View style={{ marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 4, maxWidth: 120 }}>
            <Text numberOfLines={1} style={{ fontSize: 11, color: '#333' }}>{title}</Text>
          </View>
        ) : null}
      </View>
    </PointAnnotation>
  );
};
