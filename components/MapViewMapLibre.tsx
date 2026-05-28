/**
 * MapLibre Map Component
 * 
 * Replaces react-native-maps with @maplibre/maplibre-react-native
 * Matches web implementation using MapLibre GL JS
 * 
 * This component uses OSM tiles with proper attribution to avoid blocking
 */

import React, { forwardRef, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  MapView,
  Camera,
  RasterSource,
  RasterLayer,
  ShapeSource,
  FillLayer,
  LineLayer,
  type MapViewRef,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { MAP_TILE_CONFIG } from '@/constants';
import { getGridBounds, getNeighborGrids, gridBoundsToPolygon, getNineCellBbox, isSameGridCell } from '@/utils/plusCodeGrid';
import { MarchingAntsBoxOverlay } from '@/components/MarchingAntsBoxOverlay';
import { useAnimationClock } from '@/hooks/useAnimationClock';

interface MapViewMapLibreProps {
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  style?: any;
  showGrid?: boolean;
  selectedGridRectangle?: {
    coordinates: Array<{ latitude: number; longitude: number }>;
  } | null;
  onMapPress?: (e: any) => void;
  onMapLoad?: () => void;
  children?: React.ReactNode;
  // Plus Code grid visualization props
  centerLocation?: {
    latitude: number;
    longitude: number;
  } | null;
  showNeighborSquares?: boolean;
  animateGridPulse?: boolean;
  /** When set (e.g. basic_user restriction), dims area outside the 9-cell neighborhood (black 35%). */
  restrictionCenter?: { latitude: number; longitude: number } | null;
  /** Allow panning (default true). Set false on new-create-address to lock map. */
  scrollEnabled?: boolean;
  /** Allow zoom (default true). Set false on new-create-address to lock map. */
  zoomEnabled?: boolean;
  /** Bottom padding in points so active location appears in upper half above bottom sheet. */
  cameraPaddingBottom?: number;
  /** When set (e.g. basic_user), camera stays here so 9-cell view doesn't move on neighbor click. */
  cameraCenter?: { latitude: number; longitude: number } | null;
  /** When set (e.g. basic_user), neighbors are drawn around this and the cell at centerLocation is excluded (7 green). */
  neighborCenter?: { latitude: number; longitude: number } | null;
  /** Called when the map region changes (e.g. user pan/zoom). Used e.g. to turn off follow-mode in navigation. */
  onRegionDidChange?: (payload: any) => void;
  /**
   * When set, renders the user's current position as a pulsing blue Plus Code grid cell
   * with marching-ants dashed border — matching the web and address-creation screen indicator.
   * Used for both the idle "I am here" state and the live navigation snapped position.
   */
  currentUserPosition?: { latitude: number; longitude: number } | null;
}

const OSM_SOURCE = {
  type: 'raster',
  tiles: [
    'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
  ],
  tileSize: 256,
  minzoom: 0,
  maxzoom: 19,
  attribution: '<a href="https://maplibre.org/" target="_blank">MapLibre</a> | <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a> | <a href="https://github.com/google/open-location-code" target="_blank">Plus Codes © Google</a>',
} as const;

const OSM_LAYERS = [
  {
    id: 'osm-tiles',
    type: 'raster',
    source: 'osm',
    minzoom: 0,
    maxzoom: 19,
  },
] as const;

/**
 * MapLibre Map Component
 * 
 * Matches web implementation:
 * - Uses OSM tiles with proper attribution
 * - Supports Plus Code grid overlay
 * - Supports markers, polygons, polylines
 */
const MapViewMapLibre = forwardRef<any, MapViewMapLibreProps>(
  (
    {
      initialRegion,
      style,
      showGrid = false,
      selectedGridRectangle = null,
      onMapPress,
      onMapLoad,
      children,
      centerLocation = null,
      showNeighborSquares = true,
      animateGridPulse = false,
      restrictionCenter = null,
      scrollEnabled = true,
      zoomEnabled = true,
      cameraPaddingBottom,
      cameraCenter = null,
      neighborCenter = null,
      onRegionDidChange: onRegionDidChangeProp,
      currentUserPosition = null,
    },
    ref,
  ) => {
    const mapRef = useRef<MapViewRef>(null);
    const cameraRef = useRef<CameraRef>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const { pulsePhase } = useAnimationClock();
    // Ref mirrors isMapLoaded so the fallback setTimeout closure reads a live value
    // (state is stale inside setTimeout due to JS closure capture).
    const isMapLoadedRef = useRef(false);
    // Set viewport: when cameraCenter is set (e.g. restricted user), camera stays there; else use centerLocation.
    const applyInitialCamera = useCallback(() => {
      if (!cameraRef.current) return;
      const center = (cameraCenter ?? centerLocation) ?? {
        latitude: initialRegion.latitude,
        longitude: initialRegion.longitude,
      };
      const zoom = Math.max(0, Math.min(19, Math.round(Math.log2(360 / initialRegion.latitudeDelta))));
      const padding = cameraPaddingBottom != null && cameraPaddingBottom > 0
        ? { paddingBottom: cameraPaddingBottom }
        : undefined;
      cameraRef.current.setCamera({
        centerCoordinate: [center.longitude, center.latitude],
        zoomLevel: zoom,
        animationDuration: 0,
        ...(padding && { padding }),
      });
    }, [
      cameraCenter?.latitude,
      cameraCenter?.longitude,
      centerLocation?.latitude,
      centerLocation?.longitude,
      initialRegion.latitude,
      initialRegion.longitude,
      initialRegion.latitudeDelta,
      cameraPaddingBottom,
    ]);

    // Fallback: if onDidFinishLoadingMap doesn't fire (e.g. layout delay), assume map ready.
    // Guard: only call applyInitialCamera() if the map hasn't already loaded — otherwise
    // the unconditional call at 1000ms would instant-teleport the camera back to initialRegion,
    // overwriting any parent-driven animateToRegion that fired after onMapLoad.
    useEffect(() => {
      const fallbackMs = 1000;
      const t = setTimeout(() => {
        if (!isMapLoadedRef.current) {
          isMapLoadedRef.current = true;
          setIsMapLoaded(true);
          applyInitialCamera();
        }
      }, fallbackMs);
      return () => clearTimeout(t);
    }, [applyInitialCamera]);
    const [currentCamera, setCurrentCamera] = useState<{
      center: { latitude: number; longitude: number };
      zoom: number;
      pitch?: number;
      heading?: number;
    } | null>(null);


    // Calculate zoom level from latitude delta
    const calculateZoomFromDelta = (delta: number): number => {
      // Approximate conversion: smaller delta = higher zoom
      // Formula: zoom = log2(360 / delta)
      return Math.max(0, Math.min(19, Math.round(Math.log2(360 / delta))));
    };

    // Camera target: when cameraCenter prop is set (e.g. restricted user), camera stays there; else follow centerLocation.
    const cameraTarget = (cameraCenter ?? centerLocation) ?? {
      latitude: initialRegion.latitude,
      longitude: initialRegion.longitude,
    };
    const cameraZoom = calculateZoomFromDelta(initialRegion.latitudeDelta);

    // When camera target changes, update camera. If cameraCenter prop is set, camera won't move on neighbor click.
    const prevCenterRef = useRef<{ lat: number; lng: number } | null>(null);
    useEffect(() => {
      if (!cameraTarget || !cameraRef.current) return;
      const lat = cameraTarget.latitude;
      const lng = cameraTarget.longitude;
      const prev = prevCenterRef.current;
      prevCenterRef.current = { lat, lng };
      const isFirst = prev === null;
      const moved = !prev || Math.abs(prev.lat - lat) > 1e-6 || Math.abs(prev.lng - lng) > 1e-6;
      if (isFirst || moved) {
        const padding = cameraPaddingBottom != null && cameraPaddingBottom > 0
          ? { paddingBottom: cameraPaddingBottom }
          : undefined;
        cameraRef.current.setCamera({
          centerCoordinate: [lng, lat],
          zoomLevel: cameraZoom,
          animationDuration: isFirst ? 0 : 400,
          animationMode: 'flyTo',
          ...(padding && { padding }),
        });
      }
    }, [cameraTarget?.latitude, cameraTarget?.longitude, cameraZoom, cameraPaddingBottom]);

    // Revision incremented on region change so SVG overlays can re-project (getPointInView)
    const [regionRevision, setRegionRevision] = useState(0);

    // Handle region change to track camera state and notify overlays
    const handleRegionDidChange = useCallback((payload: any) => {
      setRegionRevision((r) => r + 1);
      if (payload?.properties) {
        const { zoomLevel, centerCoordinate } = payload.properties;
        if (centerCoordinate && zoomLevel !== undefined) {
          setCurrentCamera({
            center: {
              latitude: centerCoordinate[1],
              longitude: centerCoordinate[0],
            },
            zoom: zoomLevel,
            pitch: payload.properties.pitch || 0,
            heading: payload.properties.heading || 0,
          });
        }
      }
      onRegionDidChangeProp?.(payload);
    }, [onRegionDidChangeProp]);

    // Center grid and selected-rectangle marching ants are drawn by MarchingAntsBoxOverlay (SVG).

    // Expose map methods via ref (compatible with react-native-maps API + getPointInView for SVG overlays)
    useEffect(() => {
      if (ref && typeof ref !== 'function') {
        (ref as React.MutableRefObject<any>).current = {
          getPointInView: (coordinate: [number, number]) => {
            // GeoJSON.Position is [lng, lat]; MapLibre MapViewRef.getPointInView returns [x, y]
            return mapRef.current?.getPointInView(coordinate) ?? Promise.resolve([0, 0]);
          },
          animateToRegion: (region: typeof initialRegion, duration?: number) => {
            if (cameraRef.current) {
              const padding = cameraPaddingBottom != null && cameraPaddingBottom > 0
                ? { paddingBottom: cameraPaddingBottom }
                : undefined;
              cameraRef.current.setCamera({
                centerCoordinate: [region.longitude, region.latitude],
                zoomLevel: calculateZoomFromDelta(region.latitudeDelta),
                animationDuration: duration || 1000,
                animationMode: 'flyTo',
                ...(padding && { padding }),
              });
            }
          },
          getCamera: () => {
            // Return Promise with current camera state
            return Promise.resolve(currentCamera || {
              center: {
                latitude: initialRegion.latitude,
                longitude: initialRegion.longitude,
              },
              zoom: calculateZoomFromDelta(initialRegion.latitudeDelta),
              pitch: 0,
              heading: 0,
            });
          },
          animateCamera: (config: {
            center: { latitude: number; longitude: number };
            zoom?: number;
            pitch?: number;
            heading?: number;
          }) => {
            if (cameraRef.current) {
              const padding = cameraPaddingBottom != null && cameraPaddingBottom > 0
                ? { paddingBottom: cameraPaddingBottom }
                : undefined;
              cameraRef.current.setCamera({
                centerCoordinate: [config.center.longitude, config.center.latitude],
                zoomLevel: config.zoom || currentCamera?.zoom || 15,
                pitch: config.pitch || currentCamera?.pitch || 0,
                heading: config.heading || currentCamera?.heading || 0,
                animationDuration: 300,
                animationMode: 'flyTo',
                ...(padding && { padding }),
              });
            }
          },
        };
      }
    }, [ref, currentCamera, initialRegion, cameraPaddingBottom]);

    // Handle map press
    const handlePress = useCallback(
      (feature: any) => {
        if (onMapPress && feature.geometry?.coordinates) {
          const [longitude, latitude] = feature.geometry.coordinates;
          onMapPress({
            nativeEvent: {
              coordinate: {
                latitude,
                longitude,
              },
            },
          });
        }
      },
      [onMapPress],
    );

    // Convert selectedGridRectangle coordinates to GeoJSON format for MapLibre
    const gridRectangleGeoJSON = selectedGridRectangle
      ? {
          type: 'FeatureCollection' as const,
          features: [
            {
              type: 'Feature' as const,
              geometry: {
                type: 'Polygon' as const,
                coordinates: [
                  [
                    ...selectedGridRectangle.coordinates.map(coord => [
                      coord.longitude,
                      coord.latitude,
                    ]),
                    // Close the polygon
                    [
                      selectedGridRectangle.coordinates[0].longitude,
                      selectedGridRectangle.coordinates[0].latitude,
                    ],
                  ],
                ],
              },
              properties: {},
            },
          ],
        }
      : null;

    // OSM tile attribution (required to avoid blocking)
    // Build map style object with grid visualization as GeoJSON sources
    const mapStyle = useMemo(() => {
      const sources: any = {
        osm: OSM_SOURCE,
      };

      const layers: any[] = [...OSM_LAYERS];

      // Add Plus Code grid raster overlay if enabled
      if (showGrid) {
        sources['pluscode-grid'] = {
          type: 'raster',
          tiles: [MAP_TILE_CONFIG.plusCodeGrid.urlTemplate],
          tileSize: 256,
          scheme: 'tms',
        };
        layers.push({
          id: 'pluscode-grid-layer',
          type: 'raster',
          source: 'pluscode-grid',
          paint: {
            'raster-opacity': 0.7,
          },
          minzoom: 1,
          maxzoom: 19,
        });
      }

      // Grid visualization will be added as ShapeSource children, not in mapStyle

      // Include initial camera in style so map loads at the right viewport (avoids wrong
      // default view and grid only appearing after user swipe).
      const zoom = Math.max(0, Math.min(19, Math.round(Math.log2(360 / initialRegion.latitudeDelta))));
      return {
        version: 8,
        center: [initialRegion.longitude, initialRegion.latitude],
        zoom,
        sources,
        layers,
      };
    }, [showGrid, initialRegion.latitude, initialRegion.longitude, initialRegion.latitudeDelta]);

    // Memoize grid calculations to prevent re-renders.
    // Draw grid as soon as we have centerLocation and showGrid so the green 3x3 + blue
    // squirebox appear on app load; do not wait for isMapLoaded (which can fire late).
    const gridVisualization = useMemo(() => {
      if (!centerLocation || !showGrid) {
        return null;
      }

      const centerLat = centerLocation.latitude;
      const centerLng = centerLocation.longitude;
      
      const centerBounds = getGridBounds(centerLat, centerLng);
      /** Bounds in [lng, lat] for SVG overlay getPointInView */
      const activeBoxBoundsLngLat = {
        sw: [centerBounds.sw[1], centerBounds.sw[0]] as [number, number],
        ne: [centerBounds.ne[1], centerBounds.ne[0]] as [number, number],
      };

      const centerSquareGeoJSON = {
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
      };

      const neighborLat = neighborCenter?.latitude ?? centerLat;
      const neighborLng = neighborCenter?.longitude ?? centerLng;
      let neighborBounds = showNeighborSquares
        ? getNeighborGrids(neighborLat, neighborLng)
        : [];
      if (neighborCenter && neighborBounds.length > 0) {
        neighborBounds = neighborBounds.filter((b) => {
          const midLat = (b.sw[0] + b.ne[0]) / 2;
          const midLng = (b.sw[1] + b.ne[1]) / 2;
          return !isSameGridCell(centerLat, centerLng, midLat, midLng);
        });
      }

      const neighborSquaresGeoJSON = neighborBounds.length > 0 ? {
        type: 'FeatureCollection' as const,
        features: neighborBounds.map((bounds, index) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [gridBoundsToPolygon(bounds)],
          },
          properties: { index },
        })),
      } : null;

      return {
        centerSquareGeoJSON,
        neighborSquaresGeoJSON,
        neighborBounds,
        activeBoxBoundsLngLat,
      };
    }, [centerLocation?.latitude, centerLocation?.longitude, neighborCenter?.latitude, neighborCenter?.longitude, showGrid, showNeighborSquares]);

    // Restriction overlay (Phase 3.2): full map dimmed black 35% with hole over 9-cell neighborhood.
    // Only when restrictionCenter is set (address mode + location-restricted). Hole = getNineCellBbox (web parity).
    const restrictionOverlayGeoJSON = useMemo(() => {
      if (!restrictionCenter) return null;
      const { minLat, maxLat, minLng, maxLng } = getNineCellBbox(
        restrictionCenter.latitude,
        restrictionCenter.longitude
      );
      // Outer ring: world (avoid poles)
      const outer: number[][] = [
        [-180, -85],
        [180, -85],
        [180, 85],
        [-180, 85],
        [-180, -85],
      ];
      // Inner ring (hole): 9-cell bbox [lon, lat]
      const hole: number[][] = [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ];
      return {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [outer, hole] },
        properties: {},
      };
    }, [restrictionCenter?.latitude, restrictionCenter?.longitude]);

    const getPointInViewStable = useCallback(
      (coordinate: [number, number]) =>
        mapRef.current?.getPointInView(coordinate) ?? Promise.resolve([0, 0]),
      []
    );

    // ── Current-user-position: pulsing grid cell + marching ants (navigation / idle "I am here") ──

    const userPositionLayer = useMemo(() => {
      if (!currentUserPosition) return null;
      const bounds = getGridBounds(currentUserPosition.latitude, currentUserPosition.longitude);
      return {
        geoJSON: {
          type: 'FeatureCollection' as const,
          features: [{
            type: 'Feature' as const,
            geometry: { type: 'Polygon' as const, coordinates: [gridBoundsToPolygon(bounds)] },
            properties: {},
          }],
        },
        boundsLngLat: {
          sw: [bounds.sw[1], bounds.sw[0]] as [number, number],
          ne: [bounds.ne[1], bounds.ne[0]] as [number, number],
        },
      };
    }, [currentUserPosition?.latitude, currentUserPosition?.longitude]);

    // Fallback path: selected grid rectangle when !centerLocation (legacy) – give it marching ants via SVG overlay
    const selectedRectangleBoundsLngLat = useMemo(() => {
      if (centerLocation || !selectedGridRectangle?.coordinates?.length) return null;
      const coords = selectedGridRectangle.coordinates;
      const lats = coords.map((c) => c.latitude);
      const lons = coords.map((c) => c.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      return { sw: [minLon, minLat] as [number, number], ne: [maxLon, maxLat] as [number, number] };
    }, [centerLocation, selectedGridRectangle]);

    return (
      <View style={[styles.container, style]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          mapStyle={mapStyle}
          onPress={handlePress}
          onRegionDidChange={handleRegionDidChange}
          onDidFinishLoadingMap={() => {
            isMapLoadedRef.current = true;
            setIsMapLoaded(true);
            // Set camera explicitly so viewport is correct on load (style has no center/zoom,
            // so the map would otherwise show a default view and the grid at initialRegion would be off-screen).
            applyInitialCamera();
            if (onMapLoad) onMapLoad();
          }}
          onDidFailLoadingMap={(error: any) => {
            console.log('[MapViewMapLibre] Map failed to load:', error);
          }}
          logoEnabled={false}
          attributionEnabled={true}
          attributionPosition={{ bottom: 8, right: 8 }}
          zoomEnabled={zoomEnabled}
          scrollEnabled={scrollEnabled}
          pitchEnabled={scrollEnabled}
          rotateEnabled={scrollEnabled}
        >
          {/* Restriction overlay: dim area outside 9-cell neighborhood (basic_user) */}
          {restrictionOverlayGeoJSON && (
            <ShapeSource id="restriction-overlay" shape={restrictionOverlayGeoJSON}>
              <FillLayer
                id="restriction-overlay-fill"
                style={{
                  fillColor: '#000000',
                  fillOpacity: 0.35,
                }}
              />
            </ShapeSource>
          )}

          {/* Plus Code Grid Visualization (3x3 grid with center + neighbors). Mount from first frame; style has center/zoom so viewport is correct on load. */}
          {gridVisualization && (
            <>
              {/* Center Square - Blue Fill (matches web: #1E90FF, 25% opacity). Border marching ants via MarchingAntsBoxOverlay below. */}
              <ShapeSource id="center-grid-square" shape={gridVisualization.centerSquareGeoJSON}>
                <FillLayer
                  id="center-grid-square-fill"
                  style={{
                    fillColor: '#1E90FF',
                    fillOpacity: 0.25,
                  }}
                />
              </ShapeSource>

              {/* Neighbor Squares - Green Fill (matches web: #90EE90, 25% opacity) */}
              {gridVisualization.neighborSquaresGeoJSON && (
                <ShapeSource id="neighbor-grid-squares" shape={gridVisualization.neighborSquaresGeoJSON}>
                  <FillLayer
                    id="neighbor-grid-squares-fill"
                    style={{
                      fillColor: '#90EE90',
                      fillOpacity: 0.25,
                    }}
                  />
                  <LineLayer
                    id="neighbor-grid-squares-border"
                    style={{
                      lineColor: '#32CD32',
                      lineWidth: 2,
                      lineOpacity: 1,
                    }}
                  />
                </ShapeSource>
              )}
            </>
          )}

          {/* Selected Grid Rectangle (fallback for old API) */}
          {gridRectangleGeoJSON && !centerLocation && (
            <ShapeSource id="selected-grid-rectangle" shape={gridRectangleGeoJSON}>
              <LineLayer
                id="selected-grid-rectangle-line"
                style={{
                  lineColor: '#0000ee',
                  lineWidth: 2,
                  lineOpacity: 1,
                }}
              />
            </ShapeSource>
          )}

          {/* When scrollEnabled: only set camera imperatively (effect) so user can pan/zoom.
              When !scrollEnabled: control camera so map stays locked on center. */}
          {scrollEnabled ? (
            <Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: [cameraTarget.longitude, cameraTarget.latitude],
                zoomLevel: cameraZoom,
                ...(cameraPaddingBottom != null && cameraPaddingBottom > 0 && { padding: { paddingBottom: cameraPaddingBottom } }),
              }}
            />
          ) : (
            <Camera
              ref={cameraRef}
              zoomLevel={cameraZoom}
              centerCoordinate={[cameraTarget.longitude, cameraTarget.latitude]}
              animationDuration={0}
            />
          )}

          {/* Current user position: pulsing blue grid cell (navigation snapped pos or idle GPS). */}
          {userPositionLayer && (
            <ShapeSource id="user-position-source" shape={userPositionLayer.geoJSON}>
              <FillLayer
                id="user-position-fill"
                style={{
                  fillColor: '#1E90FF',
                  fillOpacity: 0.3 + 0.18 * Math.sin(pulsePhase * 2 * Math.PI),
                }}
              />
            </ShapeSource>
          )}

          {/* Children (markers, polylines, etc.) */}
          {children}
        </MapView>
        {/* Plus Code active cell marching ants in screen space (matches web SVG overlay) */}
        {gridVisualization?.activeBoxBoundsLngLat && isMapLoaded && (
          <MarchingAntsBoxOverlay
            getPointInView={getPointInViewStable}
            bounds={gridVisualization.activeBoxBoundsLngLat}
            regionRevision={regionRevision}
          />
        )}
        {/* Selected grid rectangle (fallback when !centerLocation) – same marching ants */}
        {selectedRectangleBoundsLngLat && isMapLoaded && (
          <MarchingAntsBoxOverlay
            getPointInView={getPointInViewStable}
            bounds={selectedRectangleBoundsLngLat}
            regionRevision={regionRevision}
          />
        )}
        {/* Current user position marching ants border */}
        {userPositionLayer && isMapLoaded && (
          <MarchingAntsBoxOverlay
            getPointInView={getPointInViewStable}
            bounds={userPositionLayer.boundsLngLat}
            regionRevision={regionRevision}
          />
        )}
      </View>
    );
  },
);

MapViewMapLibre.displayName = 'MapViewMapLibre';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});

export default MapViewMapLibre;
