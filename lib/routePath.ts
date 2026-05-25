/**
 * Route Path — Graph-based pathfinding (Phase 3)
 *
 * 1. Pre-cached routes (from route_cache)
 * 2. Dijkstra on street graph
 * 3. Perpendicular/fallback path
 *
 * Ported from apps/core/mbukanji-maps/src/lib/routePath.ts
 */

import { haversineLonLat } from '@janpams/core';
import { findCachedRoute, findCachedRouteReverse, findAndTrimCachedRoute } from './routing/routeCache';
import { getStreetSegmentsInBBox, getStreetSegmentsByRegion } from './db/streetSegments';
import { parseJSON } from './db/helpers';

// ===== TYPES =====

export interface RoutePathResult {
  path: [number, number][];
  distance: number;
  success: boolean;
  debug?: {
    startStreet?: string | null;
    endStreet?: string | null;
    hopCount?: number;
    algorithm?: 'cached' | 'direct' | 'single-hop' | 'two-hop' | 'dijkstra' | 'fallback';
    routeQuality?: 1 | 2 | 3;
  };
}

export interface RoutePathOptions {
  /** Filter streets by pack/region (region_id) */
  packId?: string;
  /** Max graph radius in meters (default 1500) */
  maxDistance?: number;
  projectedStart?: [number, number];
  projectedStreetId?: string;
}

interface Bbox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface ParsedStreetSegment {
  id: string;
  name: string | null;
  geometry: [number, number][];
  bbox: Bbox;
  region_id?: string;
}

interface GraphNode {
  id: string;
  point: [number, number];
  streetId: string;
  endpointType: 'start' | 'end';
}

interface GraphEdge {
  from: string;
  to: string;
  weight: number;
  streetId: string;
  geometry: [number, number][];
}

interface Graph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge[]>;
}

// ===== GEOMETRY =====

/** Distance in meters between two [lon, lat] points (E3: shared core). */
const haversine = haversineLonLat;

function expandBbox(bbox: Bbox, meters: number): Bbox {
  const latDelta = meters / 111000;
  const lonDelta = meters / (111000 * Math.cos(((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180)));
  return {
    minLat: bbox.minLat - latDelta,
    maxLat: bbox.maxLat + latDelta,
    minLon: bbox.minLon - lonDelta,
    maxLon: bbox.maxLon + lonDelta,
  };
}

function isPointInBbox(lat: number, lon: number, bbox: Bbox): boolean {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon;
}

const SEARCH_RADIUS_PRIMARY = 200;
const SEARCH_RADIUS_EXTENDED = 800;
const GRAPH_RADIUS = 1500;
const JUNCTION_TOLERANCE = 60;
const BRIDGE_TOLERANCE = 80;
/** Radius for midpoint snapping (D2): find streets at 0.25, 0.5, 0.75 along the line */
const MIDPOINT_SEARCH_RADIUS = 300;

// ===== LOAD STREETS =====

async function loadStreetsForRoute(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number,
  options?: RoutePathOptions
): Promise<ParsedStreetSegment[]> {
  const radius = options?.maxDistance ?? GRAPH_RADIUS;
  const pointBbox: Bbox = {
    minLat: Math.min(startLat, endLat),
    maxLat: Math.max(startLat, endLat),
    minLon: Math.min(startLon, endLon),
    maxLon: Math.max(startLon, endLon),
  };
  const expanded = expandBbox(pointBbox, radius);
  let rows = await getStreetSegmentsInBBox(
    expanded.minLat,
    expanded.maxLat,
    expanded.minLon,
    expanded.maxLon
  );
  if (options?.packId) {
    rows = rows.filter(r => r.region_id === options.packId);
  }
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    geometry: (parseJSON(r.geometry) as [number, number][]) || [],
    bbox: (parseJSON(r.bbox) as Bbox) || { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 },
    region_id: r.region_id,
  }));
}

// ===== NEAREST STREET =====

function findNearestStreet(
  lon: number,
  lat: number,
  searchRadius: number,
  allStreets: ParsedStreetSegment[]
): { segment: ParsedStreetSegment; nearestPoint: [number, number]; distance: number; segmentIndex: number } | null {
  let nearestSegment: ParsedStreetSegment | null = null;
  let nearestPoint: [number, number] = [lon, lat];
  let minDistance = Infinity;
  let nearestSegmentIndex = 0;

  for (const segment of allStreets) {
    if (!isPointInBbox(lat, lon, expandBbox(segment.bbox, searchRadius))) continue;
    for (let i = 0; i < segment.geometry.length - 1; i++) {
      const start = segment.geometry[i];
      const end = segment.geometry[i + 1];
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      const lenSq = dx * dx + dy * dy;
      let t = 0;
      if (lenSq > 0) {
        t = Math.max(0, Math.min(1, ((lon - start[0]) * dx + (lat - start[1]) * dy) / lenSq));
      }
      const projPoint: [number, number] = [start[0] + t * dx, start[1] + t * dy];
      const dist = haversine([lon, lat], projPoint);
      if (dist < minDistance) {
        minDistance = dist;
        nearestPoint = projPoint;
        nearestSegment = segment;
        nearestSegmentIndex = i;
      }
    }
  }
  if (nearestSegment && minDistance <= searchRadius) {
    return { segment: nearestSegment, nearestPoint, distance: minDistance, segmentIndex: nearestSegmentIndex };
  }
  return null;
}

// ===== GRAPH =====

function createNodeId(streetId: string, endpointType: 'start' | 'end'): string {
  return `${streetId}:${endpointType}`;
}

function calculateGeometryLength(geometry: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < geometry.length - 1; i++) {
    total += haversine(geometry[i], geometry[i + 1]);
  }
  return total;
}

function buildRoadGraph(streets: ParsedStreetSegment[], searchCenter: [number, number], maxRadius: number): Graph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge[]>();
  const centerLon = searchCenter[0];
  const centerLat = searchCenter[1];

  const relevantStreets = streets.filter(street => {
    const centerLatS = (street.bbox.minLat + street.bbox.maxLat) / 2;
    const centerLonS = (street.bbox.minLon + street.bbox.maxLon) / 2;
    return haversine(searchCenter, [centerLonS, centerLatS]) <= maxRadius;
  });

  for (const street of relevantStreets) {
    const startPoint = street.geometry[0];
    const endPoint = street.geometry[street.geometry.length - 1];
    const startNodeId = createNodeId(street.id, 'start');
    const endNodeId = createNodeId(street.id, 'end');
    nodes.set(startNodeId, { id: startNodeId, point: startPoint, streetId: street.id, endpointType: 'start' });
    nodes.set(endNodeId, { id: endNodeId, point: endPoint, streetId: street.id, endpointType: 'end' });
    const streetLength = calculateGeometryLength(street.geometry);
    const edge: GraphEdge = { from: startNodeId, to: endNodeId, weight: streetLength, streetId: street.id, geometry: street.geometry };
    const reverseEdge: GraphEdge = { from: endNodeId, to: startNodeId, weight: streetLength, streetId: street.id, geometry: [...street.geometry].reverse() };
    if (!edges.has(startNodeId)) edges.set(startNodeId, []);
    if (!edges.has(endNodeId)) edges.set(endNodeId, []);
    edges.get(startNodeId)!.push(edge);
    edges.get(endNodeId)!.push(reverseEdge);
  }

  const nodeArray = Array.from(nodes.values());
  for (let i = 0; i < nodeArray.length; i++) {
    for (let j = i + 1; j < nodeArray.length; j++) {
      const nodeA = nodeArray[i];
      const nodeB = nodeArray[j];
      if (nodeA.streetId === nodeB.streetId) continue;
      const distance = haversine(nodeA.point, nodeB.point);
      if (distance <= JUNCTION_TOLERANCE) {
        const junctionEdge: GraphEdge = { from: nodeA.id, to: nodeB.id, weight: distance, streetId: 'junction', geometry: [nodeA.point, nodeB.point] };
        const reverseJunction: GraphEdge = { from: nodeB.id, to: nodeA.id, weight: distance, streetId: 'junction', geometry: [nodeB.point, nodeA.point] };
        if (!edges.has(nodeA.id)) edges.set(nodeA.id, []);
        if (!edges.has(nodeB.id)) edges.set(nodeB.id, []);
        edges.get(nodeA.id)!.push(junctionEdge);
        edges.get(nodeB.id)!.push(reverseJunction);
      }
    }
  }
  return { nodes, edges };
}

// ===== DIJKSTRA =====

function dijkstra(graph: Graph, startNodeId: string, endNodeIds: Set<string>): { path: string[]; distance: number; found: boolean } {
  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const visited = new Set<string>();
  const queue: { nodeId: string; distance: number }[] = [];
  distances.set(startNodeId, 0);
  queue.push({ nodeId: startNodeId, distance: 0 });
  let foundEndNode: string | null = null;

  while (queue.length > 0) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift()!;
    if (visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);
    if (endNodeIds.has(current.nodeId)) {
      foundEndNode = current.nodeId;
      break;
    }
    const neighborEdges = graph.edges.get(current.nodeId) || [];
    for (const edge of neighborEdges) {
      if (visited.has(edge.to)) continue;
      const newDist = current.distance + edge.weight;
      const existingDist = distances.get(edge.to) ?? Infinity;
      if (newDist < existingDist) {
        distances.set(edge.to, newDist);
        previous.set(edge.to, current.nodeId);
        queue.push({ nodeId: edge.to, distance: newDist });
      }
    }
  }
  if (!foundEndNode) return { path: [], distance: Infinity, found: false };
  const path: string[] = [];
  let current: string | undefined = foundEndNode;
  while (current) {
    path.unshift(current);
    current = previous.get(current);
  }
  return { path, distance: distances.get(foundEndNode) ?? Infinity, found: true };
}

function findClosestGraphNode(graph: Graph, point: [number, number], streetId: string): string | null {
  const startNodeId = createNodeId(streetId, 'start');
  const endNodeId = createNodeId(streetId, 'end');
  const startNode = graph.nodes.get(startNodeId);
  const endNode = graph.nodes.get(endNodeId);
  if (!startNode && !endNode) return null;
  const distToStart = startNode ? haversine(point, startNode.point) : Infinity;
  const distToEnd = endNode ? haversine(point, endNode.point) : Infinity;
  return distToStart <= distToEnd ? startNodeId : endNodeId;
}

// ===== PATH BUILDING =====

function extractGeometryBetween(
  geometry: [number, number][],
  startPoint: [number, number],
  endPoint: [number, number]
): [number, number][] {
  let startIdx = 0;
  let endIdx = geometry.length - 1;
  let minStartDist = Infinity;
  let minEndDist = Infinity;
  for (let i = 0; i < geometry.length; i++) {
    if (haversine(geometry[i], startPoint) < minStartDist) {
      minStartDist = haversine(geometry[i], startPoint);
      startIdx = i;
    }
    if (haversine(geometry[i], endPoint) < minEndDist) {
      minEndDist = haversine(geometry[i], endPoint);
      endIdx = i;
    }
  }
  if (startIdx <= endIdx) return geometry.slice(startIdx, endIdx + 1);
  return geometry.slice(endIdx, startIdx + 1).reverse();
}

function buildPathFromNodes(
  graph: Graph,
  nodePath: string[],
  startPoint: [number, number],
  endPoint: [number, number]
): [number, number][] {
  const path: [number, number][] = [startPoint];
  for (let i = 0; i < nodePath.length - 1; i++) {
    const edges = graph.edges.get(nodePath[i]) || [];
    const edge = edges.find(e => e.to === nodePath[i + 1]);
    if (edge && edge.geometry.length > 0) {
      for (const pt of edge.geometry) {
        const lastPt = path[path.length - 1];
        if (haversine(pt, lastPt) > 2) path.push(pt);
      }
    }
  }
  const lastPt = path[path.length - 1];
  if (haversine(endPoint, lastPt) > 2) path.push(endPoint);
  return path;
}

// ===== LINE INTERSECTION (for intervening street check) =====

function lineSegmentIntersection(
  a1: [number, number], a2: [number, number],
  b1: [number, number], b2: [number, number]
): [number, number] | null {
  const dxa = a2[0] - a1[0];
  const dya = a2[1] - a1[1];
  const dxb = b2[0] - b1[0];
  const dyb = b2[1] - b1[1];
  const denom = dxa * dyb - dya * dxb;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((b1[0] - a1[0]) * dyb - (b1[1] - a1[1]) * dxb) / denom;
  const u = ((b1[0] - a1[0]) * dya - (b1[1] - a1[1]) * dxa) / denom;
  const eps = 0.01;
  if (t >= eps && t <= 1 - eps && u >= eps && u <= 1 - eps) {
    return [a1[0] + t * dxa, a1[1] + t * dya];
  }
  return null;
}

function hasInterveningStreet(
  from: [number, number],
  to: [number, number],
  excludeStreetIds: Set<string>,
  allStreets: ParsedStreetSegment[]
): boolean {
  const directDistance = haversine(from, to);
  for (const street of allStreets) {
    if (excludeStreetIds.has(street.id)) continue;
    for (let i = 0; i < street.geometry.length - 1; i++) {
      const intersection = lineSegmentIntersection(from, to, street.geometry[i], street.geometry[i + 1]);
      if (intersection && haversine(from, intersection) < directDistance * 0.95) return true;
    }
  }
  return false;
}

// ===== BRIDGING (D1: single-hop and two-hop when Dijkstra fails) =====

function findClosestPointOnGeometry(
  geometry: [number, number][],
  target: [number, number]
): [number, number] {
  let closest = geometry[0];
  let minDist = haversine(geometry[0], target);
  for (const pt of geometry) {
    const d = haversine(pt, target);
    if (d < minDist) {
      minDist = d;
      closest = pt;
    }
  }
  return closest;
}

/**
 * Find a single intermediate street that connects start and end streets (within BRIDGE_TOLERANCE).
 * Used when Dijkstra fails due to graph connectivity gaps at junctions.
 */
function findBridgingStreet(
  startStreet: ParsedStreetSegment,
  endStreet: ParsedStreetSegment,
  allStreets: ParsedStreetSegment[]
): ParsedStreetSegment | null {
  const startEndpoints = [
    startStreet.geometry[0],
    startStreet.geometry[startStreet.geometry.length - 1],
  ];
  const endEndpoints = [
    endStreet.geometry[0],
    endStreet.geometry[endStreet.geometry.length - 1],
  ];
  for (const candidate of allStreets) {
    if (candidate.id === startStreet.id || candidate.id === endStreet.id) continue;
    const candEndpoints = [
      candidate.geometry[0],
      candidate.geometry[candidate.geometry.length - 1],
    ];
    const connectsToStart = startEndpoints.some(sep =>
      candEndpoints.some(cep => haversine(sep, cep) < BRIDGE_TOLERANCE)
    );
    const connectsToEnd = endEndpoints.some(eep =>
      candEndpoints.some(cep => haversine(eep, cep) < BRIDGE_TOLERANCE)
    );
    if (connectsToStart && connectsToEnd) {
      return candidate;
    }
  }
  return null;
}

/**
 * Find two intermediate streets that form a path between start and end (within BRIDGE_TOLERANCE).
 * Used when single-hop bridging fails.
 */
function findTwoHopBridge(
  startStreet: ParsedStreetSegment,
  endStreet: ParsedStreetSegment,
  allStreets: ParsedStreetSegment[]
): [ParsedStreetSegment, ParsedStreetSegment] | null {
  const startEndpoints = [
    startStreet.geometry[0],
    startStreet.geometry[startStreet.geometry.length - 1],
  ];
  const endEndpoints = [
    endStreet.geometry[0],
    endStreet.geometry[endStreet.geometry.length - 1],
  ];
  const startConnected: ParsedStreetSegment[] = [];
  for (const candidate of allStreets) {
    if (candidate.id === startStreet.id || candidate.id === endStreet.id) continue;
    const candEndpoints = [
      candidate.geometry[0],
      candidate.geometry[candidate.geometry.length - 1],
    ];
    const connectsToStart = startEndpoints.some(sep =>
      candEndpoints.some(cep => haversine(sep, cep) < BRIDGE_TOLERANCE)
    );
    if (connectsToStart) startConnected.push(candidate);
  }
  for (const bridge1 of startConnected) {
    const bridge1Endpoints = [
      bridge1.geometry[0],
      bridge1.geometry[bridge1.geometry.length - 1],
    ];
    for (const candidate of allStreets) {
      if (candidate.id === startStreet.id || candidate.id === endStreet.id || candidate.id === bridge1.id) continue;
      const candEndpoints = [
        candidate.geometry[0],
        candidate.geometry[candidate.geometry.length - 1],
      ];
      const connectsToBridge1 = bridge1Endpoints.some(b1ep =>
        candEndpoints.some(cep => haversine(b1ep, cep) < BRIDGE_TOLERANCE)
      );
      const connectsToEnd = endEndpoints.some(eep =>
        candEndpoints.some(cep => haversine(eep, cep) < BRIDGE_TOLERANCE)
      );
      if (connectsToBridge1 && connectsToEnd) return [bridge1, candidate];
    }
  }
  return null;
}

/**
 * Trace a path through bridging streets from start point to end point.
 */
function traceBridgePath(
  startStreet: ParsedStreetSegment,
  endStreet: ParsedStreetSegment,
  bridges: ParsedStreetSegment[],
  startPoint: [number, number],
  endPoint: [number, number]
): [number, number][] {
  const path: [number, number][] = [];
  const firstBridge = bridges[0];
  const startStreetEndpoints = [startStreet.geometry[0], startStreet.geometry[startStreet.geometry.length - 1]];
  const startStreetEndpoint = findClosestPointOnGeometry(startStreetEndpoints, firstBridge.geometry[0]);
  const startPath = extractGeometryBetween(startStreet.geometry, startPoint, startStreetEndpoint);
  for (const pt of startPath) {
    if (path.length === 0 || haversine(pt, path[path.length - 1]) > 2) path.push(pt);
  }
  for (let i = 0; i < bridges.length; i++) {
    const bridge = bridges[i];
    const nextTarget =
      i < bridges.length - 1
        ? bridges[i + 1].geometry[0]
        : endStreet.geometry[0];
    const entryPoint = findClosestPointOnGeometry(bridge.geometry, path[path.length - 1] ?? startPoint);
    const exitPoint = findClosestPointOnGeometry(bridge.geometry, nextTarget);
    const bridgePath = extractGeometryBetween(bridge.geometry, entryPoint, exitPoint);
    for (const pt of bridgePath) {
      if (path.length === 0 || haversine(pt, path[path.length - 1]) > 2) path.push(pt);
    }
  }
  const lastBridge = bridges[bridges.length - 1];
  const endStreetEntry = findClosestPointOnGeometry(
    endStreet.geometry,
    lastBridge.geometry[lastBridge.geometry.length - 1]
  );
  const endPath = extractGeometryBetween(endStreet.geometry, endStreetEntry, endPoint);
  for (const pt of endPath) {
    if (path.length === 0 || haversine(pt, path[path.length - 1]) > 2) path.push(pt);
  }
  return path;
}

// ===== FALLBACK WITH MIDPOINT SNAPPING (D2) =====

type NearestStreetResult = ReturnType<typeof findNearestStreet>;

/**
 * When start or end cannot snap to a street, try to find streets at 0.25, 0.5, 0.75 along the direct line.
 * If any are found, build a path through them for partial street-following; otherwise straight line.
 */
async function generateFallbackPathWithMidpointSnapping(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number,
  allStreets: ParsedStreetSegment[],
  startStreet: NearestStreetResult,
  endStreet: NearestStreetResult
): Promise<RoutePathResult> {
  const path: [number, number][] = [[startLon, startLat]];

  const checkPoints = [0.25, 0.5, 0.75];
  const foundStreets: { point: [number, number]; street: NonNullable<NearestStreetResult> }[] = [];

  for (const t of checkPoints) {
    const midLon = startLon + (endLon - startLon) * t;
    const midLat = startLat + (endLat - startLat) * t;
    const midStreet = findNearestStreet(midLon, midLat, MIDPOINT_SEARCH_RADIUS, allStreets);
    if (midStreet) {
      foundStreets.push({ point: [midLon, midLat], street: midStreet });
    }
  }

  if (foundStreets.length > 0) {
    if (startStreet) {
      path.push(startStreet.nearestPoint);
    }
    for (const fs of foundStreets) {
      const lastPt = path[path.length - 1];
      if (haversine(lastPt, fs.street.nearestPoint) > 5) {
        path.push(fs.street.nearestPoint);
      }
    }
    if (endStreet) {
      const lastPt = path[path.length - 1];
      if (haversine(lastPt, endStreet.nearestPoint) > 5) {
        path.push(endStreet.nearestPoint);
      }
    }
    path.push([endLon, endLat]);

    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      totalDistance += haversine(path[i], path[i + 1]);
    }
    return {
      path,
      distance: totalDistance,
      success: true,
      debug: {
        algorithm: 'fallback',
        startStreet: startStreet?.segment.name ?? null,
        endStreet: endStreet?.segment.name ?? null,
      },
    };
  }

  path.push([endLon, endLat]);
  return {
    path,
    distance: haversine([startLon, startLat], [endLon, endLat]),
    success: false,
    debug: { algorithm: 'fallback' },
  };
}

// ===== FALLBACK =====

function generateFallbackPath(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number,
  startStreet: ReturnType<typeof findNearestStreet>,
  endStreet: ReturnType<typeof findNearestStreet>
): RoutePathResult {
  const path: [number, number][] = [[startLon, startLat]];
  if (startStreet) path.push(startStreet.nearestPoint);
  if (endStreet && (path.length === 0 || haversine(path[path.length - 1], endStreet.nearestPoint) > 5)) path.push(endStreet.nearestPoint);
  path.push([endLon, endLat]);
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) totalDistance += haversine(path[i], path[i + 1]);
  return {
    path,
    distance: totalDistance,
    success: !!(startStreet || endStreet),
    debug: {
      algorithm: 'fallback',
      startStreet: startStreet?.segment.name ?? null,
      endStreet: endStreet?.segment.name ?? null,
    },
  };
}

// ===== MAIN =====

/**
 * Generate a path between two points: try pre-computed cache, then Dijkstra on street graph, then fallback.
 */
export async function generateRoutePath(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number,
  options?: RoutePathOptions
): Promise<RoutePathResult> {
  const hasProjection = options?.projectedStart != null;
  const effectiveStartLon = hasProjection ? options.projectedStart![0] : startLon;
  const effectiveStartLat = hasProjection ? options.projectedStart![1] : startLat;
  const effectiveStart: [number, number] = [effectiveStartLon, effectiveStartLat];
  const endCoord: [number, number] = [endLon, endLat];

  try {
    // Priority 1: Pre-computed route cache
    let cachedRoute = await findCachedRoute(effectiveStart, endCoord, 30);
    if (!cachedRoute) cachedRoute = await findCachedRouteReverse(effectiveStart, endCoord, 30);
    if (!cachedRoute) {
      const trimmed = await findAndTrimCachedRoute(effectiveStart, endCoord, 50);
      if (trimmed) {
        let path = trimmed.path;
        if (hasProjection) path = [[startLon, startLat], ...path];
        return { path, distance: trimmed.distance, success: true, debug: { algorithm: 'cached', routeQuality: 1 } };
      }
    }
    if (cachedRoute && cachedRoute.quality === 1) {
      let path = cachedRoute.path;
      if (hasProjection) path = [[startLon, startLat], ...path];
      return { path, distance: cachedRoute.distance, success: true, debug: { algorithm: 'cached', routeQuality: 1 } };
    }

    // Priority 2: Dijkstra on street graph
    const allStreets = await loadStreetsForRoute(startLon, startLat, endLon, endLat, options);
    if (allStreets.length === 0) {
      return generateFallbackPath(startLon, startLat, endLon, endLat, null, null);
    }

    let startStreet = options?.projectedStreetId
      ? (() => {
          const seg = allStreets.find(s => s.id === options.projectedStreetId);
          if (!seg) return null;
          return { segment: seg, nearestPoint: effectiveStart, distance: 0, segmentIndex: 0 };
        })()
      : findNearestStreet(effectiveStartLon, effectiveStartLat, SEARCH_RADIUS_PRIMARY, allStreets);
    if (!startStreet) startStreet = findNearestStreet(effectiveStartLon, effectiveStartLat, SEARCH_RADIUS_EXTENDED, allStreets);

    let endStreet = findNearestStreet(endLon, endLat, SEARCH_RADIUS_PRIMARY, allStreets);
    if (!endStreet) endStreet = findNearestStreet(endLon, endLat, SEARCH_RADIUS_EXTENDED, allStreets);

    if (!startStreet || !endStreet) {
      const result = await generateFallbackPathWithMidpointSnapping(
        effectiveStartLon,
        effectiveStartLat,
        endLon,
        endLat,
        allStreets,
        startStreet ?? null,
        endStreet ?? null,
      );
      if (hasProjection && result.path.length > 0) {
        result.path = [[startLon, startLat], ...result.path];
      }
      return result;
    }

    const path: [number, number][] = [[startLon, startLat]];
    const effectiveStartPt = hasProjection ? effectiveStart : startStreet.nearestPoint;
    if (haversine([startLon, startLat], effectiveStartPt) > 5) path.push(effectiveStartPt);

    let algorithm: 'direct' | 'single-hop' | 'two-hop' | 'dijkstra' | 'fallback' = 'dijkstra';
    let usedDijkstraOrBridge = false;

    if (startStreet.segment.id === endStreet.segment.id) {
      algorithm = 'direct';
      usedDijkstraOrBridge = true;
      const streetPath = extractGeometryBetween(startStreet.segment.geometry, startStreet.nearestPoint, endStreet.nearestPoint);
      for (const pt of streetPath) {
        if (haversine(pt, path[path.length - 1]) > 2) path.push(pt);
      }
    } else {
      const centerPoint: [number, number] = [(startLon + endLon) / 2, (startLat + endLat) / 2];
      const graph = buildRoadGraph(allStreets, centerPoint, options?.maxDistance ?? GRAPH_RADIUS);
      const startNodeId = findClosestGraphNode(graph, startStreet.nearestPoint, startStreet.segment.id);
      const endStartNodeId = createNodeId(endStreet.segment.id, 'start');
      const endEndNodeId = createNodeId(endStreet.segment.id, 'end');
      const endNodeIds = new Set<string>();
      if (graph.nodes.has(endStartNodeId)) endNodeIds.add(endStartNodeId);
      if (graph.nodes.has(endEndNodeId)) endNodeIds.add(endEndNodeId);

      if (startNodeId && endNodeIds.size > 0) {
        const dijkstraResult = dijkstra(graph, startNodeId, endNodeIds);
        if (dijkstraResult.found) {
          const graphPath = buildPathFromNodes(graph, dijkstraResult.path, startStreet.nearestPoint, endStreet.nearestPoint);
          const usedStreetIds = new Set<string>(dijkstraResult.path.map(nid => graph.nodes.get(nid)!.streetId));
          usedStreetIds.add(startStreet.segment.id);
          usedStreetIds.add(endStreet.segment.id);
          let pathValid = true;
          for (let i = 0; i < graphPath.length - 1 && pathValid; i++) {
            if (haversine(graphPath[i], graphPath[i + 1]) > 50 && hasInterveningStreet(graphPath[i], graphPath[i + 1], usedStreetIds, allStreets)) {
              pathValid = false;
            }
          }
          if (pathValid) {
            for (const pt of graphPath) {
              if (haversine(pt, path[path.length - 1]) > 2) path.push(pt);
            }
            algorithm = 'dijkstra';
            usedDijkstraOrBridge = true;
          }
        }
      }

      // D1: When Dijkstra fails, try single-hop then two-hop bridging (junction gaps)
      if (!usedDijkstraOrBridge) {
        const bridge = findBridgingStreet(startStreet.segment, endStreet.segment, allStreets);
        if (bridge) {
          algorithm = 'single-hop';
          usedDijkstraOrBridge = true;
          const bridgePath = traceBridgePath(
            startStreet.segment,
            endStreet.segment,
            [bridge],
            startStreet.nearestPoint,
            endStreet.nearestPoint,
          );
          for (const pt of bridgePath) {
            if (haversine(pt, path[path.length - 1]) > 2) path.push(pt);
          }
        } else {
          const twoHop = findTwoHopBridge(startStreet.segment, endStreet.segment, allStreets);
          if (twoHop) {
            algorithm = 'two-hop';
            usedDijkstraOrBridge = true;
            const bridgePath = traceBridgePath(
              startStreet.segment,
              endStreet.segment,
              twoHop,
              startStreet.nearestPoint,
              endStreet.nearestPoint,
            );
            for (const pt of bridgePath) {
              if (haversine(pt, path[path.length - 1]) > 2) path.push(pt);
            }
          }
        }
      }
    }

    if (haversine(path[path.length - 1], endStreet.nearestPoint) > 2) path.push(endStreet.nearestPoint);
    if (haversine(path[path.length - 1], [endLon, endLat]) > 2) path.push([endLon, endLat]);
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) totalDistance += haversine(path[i], path[i + 1]);

    return {
      path,
      distance: totalDistance,
      success: algorithm !== 'fallback',
      debug: {
        startStreet: startStreet.segment.name,
        endStreet: endStreet.segment.name,
        algorithm,
      },
    };
  } catch (err) {
    console.log('[RoutePath] Error:', err);
    return {
      path: [[startLon, startLat], [endLon, endLat]],
      distance: haversine([startLon, startLat], [endLon, endLat]),
      success: false,
      debug: { algorithm: 'fallback' },
    };
  }
}
