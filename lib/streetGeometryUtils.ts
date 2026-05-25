import { queryAll, parseJSON } from './db';
import type { StreetSegment } from './db/schemas';
import { haversineDistance } from './createLocationAddress';

export type Bbox = { minLat: number; maxLat: number; minLon: number; maxLon: number };

export interface SegmentWithGeometry extends Omit<StreetSegment, 'geometry' | 'bbox'> {
  geometry: [number, number][];
  bbox: Bbox;
}

export interface MergeGeometryOptions {
  anchorPoint?: [number, number];
  shouldReverseAfterMerge?: boolean;
}

export function normalizeBbox(raw: unknown): Bbox {
  if (Array.isArray(raw) && raw.length >= 4) {
    const [minLon, minLat, maxLon, maxLat] = raw as [number, number, number, number];
    return { minLat, maxLat, minLon, maxLon };
  }
  if (raw && typeof raw === 'object' && 'minLat' in raw && 'maxLon' in raw) {
    return raw as Bbox;
  }
  return { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 };
}

export function isPointInBbox(lat: number, lon: number, bbox: Bbox): boolean {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon;
}

export function expandBbox(bbox: Bbox, meters: number): Bbox {
  const latDelta = meters / 111000;
  const lonDelta = meters / (111000 * Math.cos(((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180)));
  return {
    minLat: bbox.minLat - latDelta,
    maxLat: bbox.maxLat + latDelta,
    minLon: bbox.minLon - lonDelta,
    maxLon: bbox.maxLon + lonDelta,
  };
}

export function distanceToSegment(
  point: [number, number],
  start: [number, number],
  end: [number, number]
): number {
  const [px, py] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return haversineDistance([y1, x1], [py, px]);
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return haversineDistance([y1, x1], [projY, projX]);
}

export function getStreetDisplayName(segment: { name?: string | null; ref?: string | null }): string {
  return segment.name || segment.ref || 'Unnamed Street';
}

export function arePointsConnected(
  p1: [number, number],
  p2: [number, number],
  toleranceMeters: number = 5
): boolean {
  const dist = haversineDistance([p1[1], p1[0]], [p2[1], p2[0]]);
  return dist <= toleranceMeters;
}

export async function findConnectedStreetSegments(
  startSegment: SegmentWithGeometry
): Promise<SegmentWithGeometry[]> {
  const rows = await queryAll<StreetSegment & { geometry: string; bbox: string }>(
    'SELECT * FROM street_segments'
  );
  const allSegments: SegmentWithGeometry[] = rows.map((r) => ({
    ...r,
    geometry: parseJSON<[number, number][]>(r.geometry) ?? [],
    bbox: normalizeBbox(parseJSON(r.bbox)),
  }));

  const connectedSegments: SegmentWithGeometry[] = [startSegment];
  const processedIds = new Set<string>([startSegment.id]);
  const streetName = startSegment.name ?? startSegment.ref ?? null;
  const streetType = startSegment.street_type;

  let changed = true;
  while (changed) {
    changed = false;
    for (const currentSegment of [...connectedSegments]) {
      const currentStart = currentSegment.geometry[0];
      const currentEnd = currentSegment.geometry[currentSegment.geometry.length - 1];
      for (const candidate of allSegments) {
        if (processedIds.has(candidate.id)) continue;
        const candidateName = candidate.name ?? candidate.ref ?? null;
        const nameMatches =
          streetName === null
            ? candidateName === null && candidate.street_type === streetType
            : candidateName === streetName;
        if (!nameMatches) continue;
        const candidateStart = candidate.geometry[0];
        const candidateEnd = candidate.geometry[candidate.geometry.length - 1];
        const connectsAtStart =
          arePointsConnected(currentStart, candidateStart) || arePointsConnected(currentStart, candidateEnd);
        const connectsAtEnd =
          arePointsConnected(currentEnd, candidateStart) || arePointsConnected(currentEnd, candidateEnd);
        if (connectsAtStart || connectsAtEnd) {
          connectedSegments.push(candidate);
          processedIds.add(candidate.id);
          changed = true;
        }
      }
    }
  }
  return connectedSegments;
}

function findAnchorSegment(
  segments: SegmentWithGeometry[],
  anchorPoint: [number, number]
): { segment: SegmentWithGeometry; anchorAtStart: boolean } {
  let bestSegment = segments[0];
  let bestDistance = Infinity;
  let anchorAtStart = true;
  for (const seg of segments) {
    const startDist = haversineDistance([seg.geometry[0][1], seg.geometry[0][0]], [anchorPoint[1], anchorPoint[0]]);
    const endDist = haversineDistance(
      [seg.geometry[seg.geometry.length - 1][1], seg.geometry[seg.geometry.length - 1][0]],
      [anchorPoint[1], anchorPoint[0]]
    );
    if (startDist < bestDistance) {
      bestDistance = startDist;
      bestSegment = seg;
      anchorAtStart = true;
    }
    if (endDist < bestDistance) {
      bestDistance = endDist;
      bestSegment = seg;
      anchorAtStart = false;
    }
  }
  return { segment: bestSegment, anchorAtStart };
}

export function mergeSegmentGeometries(
  segments: SegmentWithGeometry[],
  options?: MergeGeometryOptions
): [number, number][] {
  if (segments.length === 0) return [];
  if (segments.length === 1) {
    const geom = segments[0].geometry;
    return options?.shouldReverseAfterMerge ? [...geom].reverse() : [...geom];
  }

  type SegState = { segment: SegmentWithGeometry; reversed: boolean };
  const orderedSegments: SegState[] = [];
  const usedIds = new Set<string>();

  let startSegment: SegmentWithGeometry;
  let startReversed: boolean;
  if (options?.anchorPoint) {
    const { segment, anchorAtStart } = findAnchorSegment(segments, options.anchorPoint);
    startSegment = segment;
    startReversed = !anchorAtStart;
  } else {
    startSegment = segments[0];
    startReversed = false;
  }
  orderedSegments.push({ segment: startSegment, reversed: startReversed });
  usedIds.add(startSegment.id);

  let changed = true;
  while (changed && usedIds.size < segments.length) {
    changed = false;
    const firstSeg = orderedSegments[0];
    const lastSeg = orderedSegments[orderedSegments.length - 1];
    const chainStart = firstSeg.reversed
      ? firstSeg.segment.geometry[firstSeg.segment.geometry.length - 1]
      : firstSeg.segment.geometry[0];
    const chainEnd = lastSeg.reversed
      ? lastSeg.segment.geometry[0]
      : lastSeg.segment.geometry[lastSeg.segment.geometry.length - 1];

    for (const seg of segments) {
      if (usedIds.has(seg.id)) continue;
      const segStart = seg.geometry[0];
      const segEnd = seg.geometry[seg.geometry.length - 1];
      if (arePointsConnected(chainEnd, segStart)) {
        orderedSegments.push({ segment: seg, reversed: false });
        usedIds.add(seg.id);
        changed = true;
        break;
      }
      if (arePointsConnected(chainEnd, segEnd)) {
        orderedSegments.push({ segment: seg, reversed: true });
        usedIds.add(seg.id);
        changed = true;
        break;
      }
      if (arePointsConnected(chainStart, segEnd)) {
        orderedSegments.unshift({ segment: seg, reversed: false });
        usedIds.add(seg.id);
        changed = true;
        break;
      }
      if (arePointsConnected(chainStart, segStart)) {
        orderedSegments.unshift({ segment: seg, reversed: true });
        usedIds.add(seg.id);
        changed = true;
        break;
      }
    }
  }

  const mergedGeometry: [number, number][] = [];
  for (let i = 0; i < orderedSegments.length; i++) {
    const { segment, reversed } = orderedSegments[i];
    const geom = reversed ? [...segment.geometry].reverse() : segment.geometry;
    const startIdx = i === 0 ? 0 : 1;
    for (let j = startIdx; j < geom.length; j++) {
      if (
        mergedGeometry.length === 0 ||
        !arePointsConnected(mergedGeometry[mergedGeometry.length - 1], geom[j], 1)
      ) {
        mergedGeometry.push(geom[j]);
      }
    }
  }
  if (options?.shouldReverseAfterMerge) {
    return mergedGeometry.reverse();
  }
  return mergedGeometry;
}
