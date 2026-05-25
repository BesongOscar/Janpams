/* =========================================================
 * JanGo / JanPAMS Navigation Contract
 * Shared contracts for Web + Mobile
 *
 * Purpose:
 * - Keep data contracts consistent across platforms
 * - Do NOT include mobile-only engine/session implementation
 * - Web may use preview-oriented subsets of these contracts
 * - Mobile uses these contracts plus mobile navigation runtime
 * - packages/core/navigation-types/src/navigation.contract.ts
 * ======================================================= */

export type NavMode = "STANDARD" | "QR";

export type RoutingProfile = "car" | "walk" | "motor_scooter";

export type NavigationState =
  | "IDLE"
  | "RESOLVING_CONTEXT"
  | "ROUTE_PREVIEW_READY"
  | "NAVIGATING"
  | "OFF_ROUTE_RECALCULATING"
  | "ARRIVED"
  | "FAILED";

export type NavigationFailureCode =
  | "ENGINE_INIT_FAILED"
  | "PACK_MISSING"
  | "PACK_CORRUPT"
  | "PACK_INCOMPATIBLE"
  | "ROUTE_NOT_FOUND"
  | "TIMEOUT"
  | "CANCELLED"
  | "INVALID_REQUEST"
  | "GPS_UNAVAILABLE"
  | "QR_INVALID"
  | "UNKNOWN";

export interface Coordinate {
  lat: number;
  lon: number;
}

export interface LabeledCoordinate extends Coordinate {
  label?: string;
}

export interface NavigationIntent {
  mode: NavMode;
  start:
    | { type: "MY_LOCATION" }
    | {
        type: "COORD";
        lat: number;
        lon: number;
        label?: string;
      };
  destination: {
    lat: number;
    lon: number;
    label?: string;
    addressId?: string;
    qrId?: string;
  };
  routingProfile: RoutingProfile;
  packHint?: string;
  verify?: QrVerificationEnvelope;
}

export interface RouteRequest {
  locations: Coordinate[];
  costing?: string;
  directions_type?: "none" | "maneuvers";
}

export interface Maneuver {
  type: string;
  instruction?: string;
  distance?: number; // meters
  duration?: number; // seconds
  location?: Coordinate;
}

export interface ValhallaRouteResult {
  path: [lon: number, lat: number][];
  distance: number; // meters
  duration?: number; // seconds
  maneuvers?: Maneuver[];
}

export interface RouteSummary {
  distanceM: number;
  durationS?: number;
  maneuverCount: number;
}

export interface NavigationSession {
  id: string;
  state: NavigationState;
  intent: NavigationIntent;
  activeRoute?: ValhallaRouteResult;
  summary?: RouteSummary;
  startedAt?: number;
  lastUpdatedAt?: number;
  rerouteCount?: number;
  activeRequestId?: string;
  activePackId?: string;
  failureCode?: NavigationFailureCode;
  failureMessage?: string;
}

export interface PackManifest {
  packId: string;
  version: string;
  regionName?: string;
  bbox?: [minLon: number, minLat: number, maxLon: number, maxLat: number];
  checksum?: string;
  routingEngine?: {
    name: string;
    version?: string;
    formatVersion?: string;
  };
}

export interface ResolvedPack {
  packId: string;
  packPath: string;
  manifest?: PackManifest;
  checksum?: string;
}

export interface PackResolutionResult {
  status: "RESOLVED" | "MISSING" | "INCOMPATIBLE";
  packId?: string;
  resolvedPack?: ResolvedPack;
  reason?: string;
}

export interface GpsPoint extends Coordinate {
  accuracyM?: number;
  speedMps?: number;
  headingDeg?: number;
  timestamp: number;
}

export interface OffRouteResult {
  isOffRoute: boolean;
  distanceToRouteM: number;
  thresholdM: number;
}

export interface RerouteDecision {
  shouldReroute: boolean;
  reason?:
    | "OFF_ROUTE"
    | "INITIAL_ROUTE_MISSING"
    | "MANUAL_REROUTE"
    | "ROUTE_INVALIDATED";
}

export interface NavigationEngine {
  init(): Promise<void>;
  loadPack(packPath: string, options?: { checksum?: string }): Promise<void>;
  routeWithManeuvers(
    requestId: string,
    request: RouteRequest
  ): Promise<unknown | null>;
  cancel(requestId: string): Promise<void>;
}

export interface PackManager {
  resolvePackForIntent(intent: NavigationIntent): Promise<PackResolutionResult>;
  ensurePackLoaded(resolvedPack: ResolvedPack): Promise<void>;
}

export interface GpsService {
  getCurrentPosition(): Promise<GpsPoint>;
  subscribe(
    onLocation: (point: GpsPoint) => void,
    onError?: (error: unknown) => void
  ): Promise<{ remove: () => void }>;
}

export interface RouteNormalizer {
  normalize(raw: unknown): ValhallaRouteResult;
  summarize(route: ValhallaRouteResult): RouteSummary;
}

export interface OffRouteDetector {
  evaluate(args: {
    current: GpsPoint;
    route: ValhallaRouteResult;
    profile: RoutingProfile;
  }): OffRouteResult;
}

export interface ReroutePolicy {
  shouldReroute(args: {
    session: NavigationSession;
    current: GpsPoint;
    offRoute: OffRouteResult;
    now: number;
  }): RerouteDecision;
}

export interface NavigationCoreListener {
  onSessionChanged?(session: NavigationSession): void;
  onPreviewReady?(session: NavigationSession): void;
  onNavigating?(session: NavigationSession): void;
  onArrived?(session: NavigationSession): void;
  onFailed?(session: NavigationSession): void;
}

export interface QrDestinationPayload {
  v: 1;
  type: "JANPAMS_DEST";
  lat: number;
  lon: number;
  label?: string;
  pack_hint?: string;
  qr_id?: string;
}

export interface QrVerificationEnvelope {
  payload: string;
  sig: string;
  kid: string;
}

export interface QrVerificationPayload {
  v: 1;
  type: "JANPAMS_VERIFY";
  dest: {
    lat: number;
    lon: number;
    label?: string;
    qr_id?: string;
  };
  payload: string;
  sig: string;
  kid: string;
}

export type SupportedQrPayload = QrDestinationPayload | QrVerificationPayload;

export function isCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.lat === "number" && typeof obj.lon === "number";
}

export function isSupportedQrPayload(
  value: unknown
): value is SupportedQrPayload {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return obj.v === 1 && (obj.type === "JANPAMS_DEST" || obj.type === "JANPAMS_VERIFY");
}