import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import MapView from 'react-native-maps';

interface MapControlsProps {
  mapRef: React.RefObject<MapView>;
  showGrid: boolean;
  onToggleGrid: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggle3D: () => void;
  onCenterLocation: () => void;
  onOpenOfflineManager?: () => void;
  show3D?: boolean;
  top?: any;
  bottomOffset?: number;
}

export const MapControls: React.FC<MapControlsProps> = ({
  showGrid,
  onToggleGrid,
  onZoomIn,
  onZoomOut,
  onToggle3D,
  onCenterLocation,
  onOpenOfflineManager,
  show3D = false,
  top = '60%',
  bottomOffset = 0,
}) => {
  // Calculate bottom position based on bottomOffset
  // When bottomOffset is 0, use top positioning, otherwise use bottom positioning
  // When bottom sheet is visible, position controls above it (bottomSheetHeight + tab bar height + padding)
  const tabBarHeight = 140; // Tab bar height
  const padding = 20; // Padding between controls and tab bar
  const containerStyle = bottomOffset > 0
    ? { bottom: bottomOffset + tabBarHeight + padding } // Position above bottom sheet + tab bar
    : { top: top as any };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Grid Toggle */}
      <TouchableOpacity
        style={[styles.controlButton, showGrid && styles.controlButtonActive]}
        onPress={onToggleGrid}>
        <Image
          source={
            // showGrid
            //   ? 
              require('@/assets/images/grid_blue.png')
              // : require('@/assets/images/grid_black.png')
          }
          style={styles.iconImage}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Zoom In */}
      <TouchableOpacity style={styles.controlButton} onPress={onZoomIn}>
      <Image
          source={
            // showGrid
            //   ? 
              require('@/assets/images/plus_blue.png')
              // : require('@/assets/images/grid_black.png')
          }
          style={styles.iconImage}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Zoom Out */}
      <TouchableOpacity style={styles.controlButton} onPress={onZoomOut}>
      <Image
          source={
            // showGrid
            //   ? 
              require('@/assets/images/minus_blue.png')
              // : require('@/assets/images/grid_black.png')
          }
          style={styles.iconImage}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* 3D Toggle */}
      <TouchableOpacity
        style={[styles.controlButton, show3D && styles.controlButtonActive]}
        onPress={onToggle3D}>
        <Image
          source={
            // show3D
            //   ? 
              require('@/assets/images/maptype.png')
              // : require('@/assets/images/3d_black.png')
          }
          style={styles.iconImage}
          tintColor={Colors.primary[500]}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Center Location */}
      <TouchableOpacity style={styles.controlButton} onPress={onCenterLocation}>
      <Image
          source={
            // showGrid
            //   ? 
              require('@/assets/images/loc_blue.png')
              // : require('@/assets/images/grid_black.png')
          }
          style={styles.iconImage}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Offline Data Manager */}
      {onOpenOfflineManager && (
        <TouchableOpacity
          style={styles.controlButton}
          onPress={onOpenOfflineManager}>
          <Image
            source={require('@/assets/images/map_download_data.png')}
            style={styles.iconImage}
            resizeMode="contain"
            tintColor={Colors.primary[500]}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    gap: 12,
    zIndex: 1000,
  },
  controlButton: {
    width: 30,
    height: 30,
    borderRadius: 20,
    // backgroundColor: Colors.light[10],
    justifyContent: 'center',
    alignItems: 'center',
    // elevation: 3,
    // shadowColor: '#000',
    // shadowOffset: {
    //   width: 0,
    //   height: 2,
    // },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  controlButtonActive: {
    // backgroundColor: Colors.primary[500],
  },
  iconImage: {
    width: 20,
    height: 20,
  },
});
