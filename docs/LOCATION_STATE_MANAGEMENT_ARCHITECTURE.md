# Location State Management Architecture

## Table of Contents
1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Architecture Design](#architecture-design)
4. [Core Components](#core-components)
5. [Data Flow](#data-flow)
6. [State Management Patterns](#state-management-patterns)
7. [Configuration & Thresholds](#configuration--thresholds)
8. [User Experience Flows](#user-experience-flows)
9. [Technical Implementation](#technical-implementation)
10. [Integration Guide](#integration-guide)
11. [Testing Strategy](#testing-strategy)
12. [Future Considerations](#future-considerations)

---

## Overview

This document describes the architectural design and implementation of the location-aware form state management system for JanGO. The system ensures that address creation forms always use fresh, accurate location data while preserving user-entered information, preventing coordinate/image mismatches that could result in incorrect address submissions.

### Key Principles

1. **Location Context Separation**: User inputs are persisted separately from location-derived data
2. **Freshness Enforcement**: Location data is always validated for freshness and accuracy
3. **Progressive Reset Strategy**: Soft resets preserve user input, hard resets clear everything
4. **User Transparency**: All resets are communicated to users with clear messaging
5. **Session-Only Persistence**: Form state persists only within the app session, not across restarts

---

## Problem Statement

### Original Issues

1. **Stale Location Data**: Forms could initialize with old coordinates from AsyncStorage, leading to mismatches between:
   - Photo location (current)
   - Coordinate location (stale)
   - Address components (stale)

2. **Unpredictable Refreshes**: App would refresh unexpectedly or fail to refresh when needed, causing:
   - User confusion
   - Lost form data
   - Inconsistent behavior across platforms

3. **No Location Validation**: Forms could be submitted with:
   - Old location data (>5 minutes old)
   - Poor accuracy (>50m)
   - Mismatched coordinates and images

### Requirements

- **R1**: Forms must always use fresh location on open (no stale storage)
- **R2**: User inputs persist across navigation, location context refreshes
- **R3**: Location changes >20m prompt user, >50m force reset
- **R4**: Location age >30s is stale, >120s forces hard reset
- **R5**: Accuracy >50m blocks submission
- **R6**: Image cleared if location changes >50m
- **R7**: All resets show explanatory messages
- **R8**: Background time >60s triggers hard reset

---

## Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Form Components                           │
│  (create-address.tsx, AddUnitInfo.tsx)                        │
└──────────────┬──────────────────────────────────────────────┘
               │
               ├─────────────────┬──────────────────┐
               │                 │                  │
┌──────────────▼──────┐ ┌────────▼────────┐ ┌───────▼──────────┐
│ useLocationContext  │ │useFormState     │ │useFormResetWith  │
│                     │ │Persistence     │ │Location           │
│ - Freshness         │ │                │ │                   │
│ - Validation        │ │ - Auto-save    │ │ - Soft/Hard Reset │
│ - Accuracy          │ │ - Restore      │ │ - Monitoring      │
└──────────────┬──────┘ │ - Clear        │ │ - App State       │
               │        └────────────────┘ └───────┬──────────┘
               │                                    │
               └────────────────┬───────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │  Location Services    │
                    │  (expo-location)      │
                    └───────────────────────┘
```

### Component Hierarchy

```
Form Component
├── useLocationContext (location freshness)
├── useFormStatePersistence (user inputs)
├── useFormResetWithLocation (reset logic)
│   └── useLocationContext (internal)
├── LocationRefreshBanner (soft prompts)
└── LocationValidationDialog (hard resets)
```

---

## Core Components

### 1. `useLocationContext` Hook

**Purpose**: Manages location freshness, validation, and accuracy checking.

**Location**: `hooks/useLocationContext.ts`

**Key Responsibilities**:
- Fetch fresh location from device
- Track location age and staleness
- Validate location for form submission
- Calculate distance between locations
- Monitor location accuracy

**State Management**:
```typescript
interface LocationContextState {
  currentLocation: LocationObjectCoords | null;
  locationAge: number;           // Age in milliseconds
  isStale: boolean;              // Soft stale (>30s)
  isHardStale: boolean;         // Hard stale (>120s)
  accuracy: number | null;      // Accuracy in meters
  isFetching: boolean;
  error: string | null;
  lastFetchTime: number | null;
}
```

**Key Methods**:
- `refreshLocation()`: Fetches fresh location from device
- `validateForSubmit()`: Validates location before submission
- `calculateDistance()`: Calculates distance between two coordinates

**Lifecycle**:
1. Auto-starts on mount (if `autoStart: true`)
2. Updates location age every second
3. Triggers callbacks on staleness thresholds

---

### 2. `useFormStatePersistence` Hook

**Purpose**: Persists user-entered form fields (session-only).

**Location**: `hooks/useFormStatePersistence.ts`

**Key Responsibilities**:
- Save user inputs to AsyncStorage
- Restore inputs on form mount
- Auto-save with debouncing
- Clear state on hard reset

**Configuration**:
```typescript
interface UseFormStatePersistenceOptions<T> {
  formId: string;                    // Unique form identifier
  persistFields: Array<keyof T>;     // Fields to persist
  excludeFields?: Array<keyof T>;    // Fields to exclude
  autoSave?: boolean;                // Auto-save on changes
  debounceMs?: number;               // Debounce delay
}
```

**Storage Strategy**:
- Key format: `@formState_{formId}`
- Only persists specified fields
- Excludes location-derived data
- Session-only (cleared on app restart)

**Auto-Save Behavior**:
- Debounced saves (default 500ms)
- Saves on field changes
- Prevents excessive storage writes

---

### 3. `useFormResetWithLocation` Hook

**Purpose**: Unified reset logic based on location changes, app state, and navigation.

**Location**: `hooks/useFormResetWithLocation.ts`

**Key Responsibilities**:
- Monitor location changes via `watchPositionAsync`
- Handle app state changes (background/foreground)
- Handle navigation focus (iOS only)
- Determine reset type (soft vs hard)
- Trigger appropriate reset callbacks

**Reset Types**:

**Soft Reset**:
- Distance: 20-50m
- Action: Refresh location context, keep user inputs
- UI: Banner notification (auto-dismiss)

**Hard Reset**:
- Distance: >50m
- Background time: >60s
- Location age: >120s
- Action: Clear everything, navigate home
- UI: Dialog (requires user action)

**Monitoring Configuration**:
```typescript
{
  accuracy: Location.Accuracy.High,
  timeInterval: 15000,      // Check every 15s
  distanceInterval: 10,      // Check when moved 10m
}
```

**Reset Triggers**:

| Trigger | Condition | Reset Type |
|---------|-----------|------------|
| Location Change | 20-50m | Soft |
| Location Change | >50m | Hard |
| App Background | >60s | Hard |
| Location Age | >120s | Hard |
| Location Accuracy | >50m | Block Submit |

---

### 4. `LocationRefreshBanner` Component

**Purpose**: Non-blocking UI for soft reset prompts.

**Location**: `components/LocationRefreshBanner.tsx`

**Features**:
- Auto-dismisses after 5 seconds
- Shows distance moved
- "Refresh" action button
- Non-intrusive design

**Usage**:
```typescript
<LocationRefreshBanner
  visible={showBanner}
  message="Location changed. Refresh form?"
  distance={35}
  onRefresh={handleRefresh}
  onDismiss={handleDismiss}
/>
```

---

### 5. `LocationValidationDialog` Component

**Purpose**: Blocking UI for hard resets and validation errors.

**Location**: `components/LocationValidationDialog.tsx`

**Features**:
- Requires user action
- Shows reset reason
- Type-based styling (error/warning/info)
- Configurable buttons

**Usage**:
```typescript
<LocationValidationDialog
  visible={showDialog}
  title="Location Changed"
  message="You moved 85m. Form will be reset."
  reason="Location is old"
  onConfirm={handleConfirm}
  onCancel={handleCancel}
  type="warning"
/>
```

---

## Data Flow

### Form Initialization Flow

```
1. Form Component Mounts
   │
   ├─► useLocationContext.autoStart = true
   │   └─► Fetches fresh location immediately
   │
   ├─► useFormStatePersistence.restoreState()
   │   └─► Restores user inputs from AsyncStorage
   │
   └─► useFormResetWithLocation initializes
       ├─► Starts location monitoring
       └─► Sets up app state listeners
```

### Location Change Flow

```
Location Change Detected (watchPositionAsync)
   │
   ├─► Calculate distance from initial location
   │
   ├─► Distance < 20m
   │   └─► Update lastKnownLocation (silent)
   │
   ├─► Distance 20-50m
   │   ├─► Determine reset type: 'soft'
   │   ├─► Call onSoftReset(reason)
   │   ├─► Refresh location context
   │   ├─► Keep user inputs
   │   └─► Show LocationRefreshBanner
   │
   └─► Distance > 50m
       ├─► Determine reset type: 'hard'
       ├─► Call onHardReset(reason)
       ├─► Clear form state
       ├─► Clear image (if distance > 50m)
       ├─► Navigate to home
       └─► Show LocationValidationDialog
```

### Form Submission Flow

```
User Clicks Submit
   │
   ├─► locationContext.validateForSubmit()
   │   │
   │   ├─► Check location exists
   │   ├─► Check location age < 30s
   │   ├─► Check accuracy < 50m
   │   └─► Check not hard stale
   │
   ├─► Validation Passes
   │   ├─► Use locationContext.currentLocation
   │   ├─► Submit form data
   │   └─► Clear form state on success
   │
   └─► Validation Fails
       ├─► Show LocationValidationDialog
       ├─► Block submission
       └─► Offer refresh option
```

### App State Change Flow

```
App Goes to Background
   │
   └─► Record backgroundTime = Date.now()

App Returns to Foreground
   │
   ├─► Calculate backgroundDuration
   │
   ├─► backgroundDuration < 2s
   │   └─► Ignore (likely keyboard/focus event)
   │
   ├─► backgroundDuration 2-60s
   │   ├─► Fetch fresh location
   │   ├─► Compare with lastKnownLocation
   │   ├─► If moved > 20m: Soft reset
   │   └─► If moved < 20m: Silent refresh
   │
   └─► backgroundDuration > 60s
       ├─► Hard reset
       ├─► Clear form state
       └─► Navigate to home
```

---

## State Management Patterns

### Location State

**Source of Truth**: `useLocationContext.currentLocation`

**Updates**:
- Fresh fetch on form open
- Continuous monitoring via `watchPositionAsync`
- Manual refresh via `refreshLocation()`

**Derived State**:
- `locationAge`: Calculated from `lastFetchTime`
- `isStale`: `locationAge > MAX_AGE_MS`
- `isHardStale`: `locationAge > HARD_STALE_AGE_MS`

### Form State

**User Inputs** (Persisted):
- Stored in component state
- Auto-saved to AsyncStorage
- Restored on mount

**Location-Derived** (Not Persisted):
- `coordinates`
- `addressComponents`
- `city`, `region`, `street`, `neighbourhood`, `country`
- `image` (cleared if location changes >50m)

### Reset State

**Soft Reset State**:
```typescript
{
  showLocationBanner: boolean;
  locationBannerMessage: string;
  locationBannerDistance?: number;
}
```

**Hard Reset State**:
```typescript
{
  showLocationDialog: boolean;
  locationDialogReason: ResetReason | null;
}
```

---

## Configuration & Thresholds

### Location Thresholds

**File**: `constants/locationThresholds.ts`

```typescript
export const LOCATION_THRESHOLDS = {
  MAX_BG_MS: 60_000,              // 1 min → force refresh on return
  MAX_AGE_MS: 30_000,             // 30s → treat location stale
  HARD_STALE_AGE_MS: 120_000,     // 120s → force hard reset
  MAX_MOVE_SOFT_M: 20,            // 20m → prompt refresh
  MAX_MOVE_HARD_M: 50,            // 50m → force refresh/reset
  ACCURACY_THRESHOLD_M: 50,       // 50m → require retry/confirmation
  LOCATION_CHECK_INTERVAL_MS: 15_000,  // 15s monitoring interval
  LOCATION_CHECK_DISTANCE_M: 10,        // 10m distance interval
  BANNER_AUTO_DISMISS_MS: 5_000,       // 5s banner auto-dismiss
};
```

### Threshold Rationale

| Threshold | Value | Rationale |
|-----------|-------|-----------|
| `MAX_AGE_MS` | 30s | Prevents using location that's more than 30 seconds old, ensuring accuracy |
| `HARD_STALE_AGE_MS` | 120s | After 2 minutes, location is definitely stale and form should reset |
| `MAX_MOVE_SOFT_M` | 20m | Small movements might be GPS drift, prompt user to confirm |
| `MAX_MOVE_HARD_M` | 50m | Significant movement indicates user has moved, force reset |
| `ACCURACY_THRESHOLD_M` | 50m | Accuracy worse than 50m is unreliable for addressing |
| `MAX_BG_MS` | 60s | App idle for >1 minute likely means user moved |

---

## User Experience Flows

### Scenario 1: Normal Form Completion

```
1. User opens form
   └─► Fresh location fetched automatically
   
2. User enters data
   └─► Data auto-saved to session storage
   
3. User submits
   └─► Location validated
   └─► Form submitted successfully
   └─► Session storage cleared
```

### Scenario 2: User Moves While Filling Form

```
1. User opens form at Location A
   └─► Initial location recorded
   
2. User moves 35m to Location B
   └─► Location monitoring detects change
   └─► Soft reset triggered
   └─► Banner appears: "You moved ~35m. Refresh form?"
   
3. User clicks "Refresh"
   └─► Location context refreshed
   └─► User inputs preserved
   └─► Address components updated
   
4. User continues filling form
   └─► Form uses Location B data
```

### Scenario 3: User Moves Significantly

```
1. User opens form at Location A
   └─► Initial location recorded
   
2. User moves 75m to Location B
   └─► Location monitoring detects change
   └─► Hard reset triggered
   └─► Dialog appears: "You moved 75m. Form will be reset."
   
3. User confirms
   └─► Form cleared
   └─► Image cleared (if exists)
   └─► Navigated to home screen
   └─► User must start over at Location B
```

### Scenario 4: App Goes to Background

```
1. User opens form and starts filling
   
2. User switches to another app (45 seconds)
   └─► Background time recorded
   
3. User returns to app
   └─► Background duration < 60s
   └─► Fresh location fetched
   └─► Compared with last known location
   └─► If moved < 20m: Silent refresh
   └─► If moved 20-50m: Soft reset with banner
   └─► If moved > 50m: Hard reset with dialog
```

### Scenario 5: Location Accuracy Issue

```
1. User opens form
   └─► Location fetched with accuracy 75m
   
2. User fills form
   └─► Form interaction allowed
   └─► Warning shown (if implemented)
   
3. User tries to submit
   └─► Validation fails: "Location accuracy is low (75m)"
   └─► Dialog appears: "Please move to an open area or retry"
   └─► Submission blocked
   
4. User moves to open area
   └─► Location refreshed
   └─► Accuracy improves to 15m
   └─► Submission allowed
```

---

## Technical Implementation

### Location Monitoring

**Implementation**: `watchPositionAsync` from expo-location

**Configuration**:
```typescript
Location.watchPositionAsync(
  {
    accuracy: Location.Accuracy.High,
    timeInterval: 15000,      // Check every 15 seconds
    distanceInterval: 10,     // Check when moved 10 meters
  },
  location => {
    // Process location update
  }
);
```

**Optimization**:
- High accuracy for precise addressing
- 15s interval balances responsiveness and battery
- 10m distance interval prevents excessive updates

### Form State Persistence

**Storage**: AsyncStorage (session-only)

**Key Format**: `@formState_{formId}`

**Data Structure**:
```typescript
{
  businessName?: string;
  addressCategory?: string;
  houseNumber?: string;
  extension?: string;
  unitNumber?: string;
  unitType?: string;
  checked?: boolean;
}
```

**Persistence Strategy**:
- Auto-save with 500ms debounce
- Only persists user-entered fields
- Excludes location-derived data
- Cleared on hard reset or successful submission

### Reset Logic

**Soft Reset Implementation**:
```typescript
const handleSoftReset = async (reason: ResetReason) => {
  // Refresh location
  await locationContext.refreshLocation();
  
  // Keep user inputs (already in state)
  
  // Clear image if moved > 50m
  if (reason.distance && reason.distance >= 50) {
    setImage(undefined);
  }
  
  // Show banner
  setShowLocationBanner(true);
};
```

**Hard Reset Implementation**:
```typescript
const handleHardReset = async (reason: ResetReason) => {
  // Clear all form fields
  resetForm();
  
  // Clear persisted state
  await clearFormState();
  
  // Clear stored coordinates
  await deleteData('@currentCoordinates');
  
  // Show dialog
  setShowLocationDialog(true);
};
```

### Location Validation

**Pre-Submission Validation**:
```typescript
const validateForSubmit = (): { isValid: boolean; reason?: string } => {
  // Check location exists
  if (!currentLocation) {
    return { isValid: false, reason: 'No location available' };
  }
  
  // Check location age
  if (locationAge > MAX_AGE_MS) {
    return { isValid: false, reason: 'Location is stale. Please refresh.' };
  }
  
  // Check accuracy
  if (accuracy > ACCURACY_THRESHOLD_M) {
    return {
      isValid: false,
      reason: `Location accuracy is low (${Math.round(accuracy)}m). Please move to an open area or retry.`
    };
  }
  
  // Check hard stale
  if (isHardStale) {
    return { isValid: false, reason: 'Location is too old. Please refresh.' };
  }
  
  return { isValid: true };
};
```

---

## Integration Guide

### Adding to a New Form

1. **Import Required Hooks**:
```typescript
import { useLocationContext } from '@/hooks/useLocationContext';
import { useFormStatePersistence } from '@/hooks/useFormStatePersistence';
import { useFormResetWithLocation } from '@/hooks/useFormResetWithLocation';
import { LocationRefreshBanner } from '@/components/LocationRefreshBanner';
import { LocationValidationDialog } from '@/components/LocationValidationDialog';
```

2. **Define Form State Type**:
```typescript
type FormState = {
  field1?: string;
  field2?: string;
  // ... user-entered fields only
};
```

3. **Initialize Hooks**:
```typescript
// Location context
const locationContext = useLocationContext({
  autoStart: true,
});

// Form state persistence
const { restoreState, saveStateDebounced, clearState } = useFormStatePersistence<FormState>({
  formId: 'my-form',
  persistFields: ['field1', 'field2'],
  autoSave: true,
});

// Reset logic
const { locationContext: resetLocationContext } = useFormResetWithLocation({
  onSoftReset: handleSoftReset,
  onHardReset: handleHardReset,
  shouldResetOnAppStateChange: true,
  shouldResetOnLocationChange: true,
});
```

4. **Restore State on Mount**:
```typescript
useEffect(() => {
  const initializeForm = async () => {
    const restored = await restoreState();
    if (restored) {
      // Restore fields
      setField1(restored.field1);
      setField2(restored.field2);
    }
  };
  initializeForm();
}, [restoreState]);
```

5. **Auto-Save on Changes**:
```typescript
useEffect(() => {
  saveStateDebounced({
    field1,
    field2,
  });
}, [field1, field2, saveStateDebounced]);
```

6. **Validate Before Submit**:
```typescript
const handleSubmit = async () => {
  const validation = locationContext.validateForSubmit();
  if (!validation.isValid) {
    // Show error dialog
    return;
  }
  
  // Proceed with submission
};
```

7. **Add UI Components**:
```typescript
return (
  <>
    {/* Form content */}
    
    <LocationRefreshBanner
      visible={showBanner}
      message={bannerMessage}
      onRefresh={handleRefresh}
      onDismiss={handleDismiss}
    />
    
    <LocationValidationDialog
      visible={showDialog}
      title="Location Changed"
      message={dialogMessage}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  </>
);
```

---

## Testing Strategy

### Unit Tests

**Test Files**:
- `hooks/__tests__/useLocationContext.test.ts`
- `hooks/__tests__/useFormStatePersistence.test.ts`
- `hooks/__tests__/useFormResetWithLocation.test.ts`

**Test Cases**:

1. **Location Context**:
   - Fresh location fetch
   - Staleness calculation
   - Accuracy validation
   - Distance calculation

2. **Form State Persistence**:
   - Save/restore cycle
   - Debouncing behavior
   - Field filtering
   - Clear functionality

3. **Reset Logic**:
   - Soft reset triggers
   - Hard reset triggers
   - App state handling
   - Location monitoring

### Integration Tests

**Test Scenarios**:

1. **Form Initialization**:
   - Fresh location fetched
   - State restored correctly
   - Monitoring started

2. **Location Changes**:
   - Small movement (<20m): Silent
   - Medium movement (20-50m): Soft reset
   - Large movement (>50m): Hard reset

3. **App State Changes**:
   - Short background (<2s): Ignored
   - Medium background (2-60s): Location refresh
   - Long background (>60s): Hard reset

4. **Form Submission**:
   - Valid location: Submission allowed
   - Stale location: Submission blocked
   - Poor accuracy: Submission blocked

### Manual Testing Checklist

- [ ] Form opens with fresh location
- [ ] User inputs persist across navigation
- [ ] Location changes trigger appropriate resets
- [ ] App background/foreground handled correctly
- [ ] Location validation blocks invalid submissions
- [ ] Banners and dialogs display correctly
- [ ] Image cleared on significant location change
- [ ] Form state cleared on successful submission

---

## Future Considerations

### Potential Enhancements

1. **Remote Configuration**:
   - Fetch thresholds from server
   - A/B testing different values
   - Dynamic adjustment based on usage

2. **Location Caching**:
   - Cache recent locations with timestamps
   - Use cached location if fresh (<30s)
   - Reduce battery consumption

3. **Advanced Validation**:
   - Check location matches image timestamp
   - Validate coordinate consistency
   - Detect GPS spoofing

4. **Analytics**:
   - Track reset frequency
   - Monitor location accuracy
   - Measure user impact

5. **Offline Support**:
   - Queue location updates
   - Sync when online
   - Handle offline validation

### Performance Optimizations

1. **Debouncing**:
   - Increase debounce for auto-save
   - Reduce location check frequency when idle

2. **Battery Optimization**:
   - Reduce monitoring frequency when form not visible
   - Use lower accuracy when appropriate

3. **Memory Management**:
   - Clear old location data
   - Limit persisted state size

---

## Appendix

### File Structure

```
hooks/
├── useLocationContext.ts          # Location freshness & validation
├── useFormStatePersistence.ts     # Form state persistence
└── useFormResetWithLocation.ts    # Unified reset logic

components/
├── LocationRefreshBanner.tsx      # Soft reset UI
└── LocationValidationDialog.tsx   # Hard reset UI

constants/
└── locationThresholds.ts          # Configuration thresholds

app/
├── create-address.tsx             # Main form (integrated)
└── components/
    └── AddUnitInfo.tsx            # Modal form (integrated)
```

### Dependencies

- `expo-location`: Location services
- `@react-native-async-storage/async-storage`: State persistence
- `react-native-paper`: UI components
- `expo-router`: Navigation

### Related Documentation

- [Expo Location API](https://docs.expo.dev/versions/latest/sdk/location/)
- [React Native AsyncStorage](https://react-native-async-storage.github.io/async-storage/)
- [React Query Documentation](https://tanstack.com/query/latest)

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Author**: Development Team  
**Status**: Production Ready

