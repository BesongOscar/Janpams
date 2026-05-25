import { useState, useEffect } from 'react';
import { estimateTravelTime, decodePolyline } from '../utils';
import { useGetJangoRoute } from './addresses.hooks';

interface Waypoint {
  displayValue: string;
  coordinates: string;
}

interface Location {
  displayValue: string;
  coordinates: string;
}

interface RouteState {
  waypoints: Waypoint[];
  startingLocation?: Location;
  destination?: Location;
  routeCoordinates: Array<{
    longitude: number;
    latitude: number;
  }>;
  startMarker?: {
    longitude: number;
    latitude: number;
  };
  endMarker?: {
    longitude: number;
    latitude: number;
  };
  estimatedTravelTime?: {
    driving: string;
    bicycling: string;
    walking: string;
  };
}

export const useRoute = () => {
  const [routeState, setRouteState] = useState<RouteState>({
    waypoints: [],
    routeCoordinates: [],
  });

  const {
    data: routeData,
    isLoading: isRouteLoading,
    refetch: getRoute,
  } = useGetJangoRoute({
    startingLocation: routeState.startingLocation?.coordinates,
    destination: routeState.destination?.coordinates,
    waypoints: routeState.waypoints.map(w => w.coordinates),
  });

  // Update route coordinates when route data changes
  useEffect(() => {
    if (routeData?.routes?.[0]?.polyline) {
      const coordinates = decodePolyline(routeData.routes[0].polyline);
      setRouteState(prev => ({
        ...prev,
        routeCoordinates: coordinates,
      }));
    }
  }, [routeData]);

  // Update markers when starting location or destination changes
  useEffect(() => {
    if (routeState.startingLocation?.coordinates) {
      const [longitude, latitude] = routeState.startingLocation.coordinates
        .split(',')
        .map(Number);
      setRouteState(prev => ({
        ...prev,
        startMarker: { longitude, latitude },
      }));
    }
  }, [routeState.startingLocation]);

  useEffect(() => {
    if (routeState.destination?.coordinates) {
      const [longitude, latitude] = routeState.destination.coordinates
        .split(',')
        .map(Number);
      setRouteState(prev => ({
        ...prev,
        endMarker: { longitude, latitude },
      }));
    }
  }, [routeState.destination]);

  // Calculate estimated travel time
  useEffect(() => {
    if (routeData?.routes?.[0]?.duration) {
      const travelTime = estimateTravelTime(routeData.routes[0].duration);
      setRouteState(prev => ({
        ...prev,
        estimatedTravelTime: travelTime,
      }));
    }
  }, [routeData]);

  const setStartingLocation = (location: Location | undefined) => {
    setRouteState(prev => ({
      ...prev,
      startingLocation: location,
    }));
  };

  const setDestination = (location: Location | undefined) => {
    setRouteState(prev => ({
      ...prev,
      destination: location,
    }));
  };

  const addWaypoint = (waypoint: Waypoint) => {
    setRouteState(prev => ({
      ...prev,
      waypoints: [...prev.waypoints, waypoint],
    }));
  };

  const removeWaypoint = (index: number) => {
    setRouteState(prev => ({
      ...prev,
      waypoints: prev.waypoints.filter((_, i) => i !== index),
    }));
  };

  const resetRoute = () => {
    setRouteState({
      waypoints: [],
      routeCoordinates: [],
    });
  };

  return {
    ...routeState,
    isRouteLoading,
    getRoute,
    setStartingLocation,
    setDestination,
    addWaypoint,
    removeWaypoint,
    resetRoute,
  };
};
