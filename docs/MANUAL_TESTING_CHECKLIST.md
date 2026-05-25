# Manual Testing Checklist

## Pre-Testing Setup

- [ ] Clean install app (delete app, reinstall)
- [ ] Clear app data/cache
- [ ] Ensure test account is ready
- [ ] Note current app version
- [ ] Note device OS version
- [ ] Note network conditions (WiFi/Cellular)

---

## Phase 1: Basic Functionality

### Address Creation (Online)
- [ ] Open create-address form
- [ ] Fill in all required fields
- [ ] Verify geocoding populates fields automatically
- [ ] Verify house number is suggested (if street data available)
- [ ] Submit address
- [ ] Verify address appears in my-addresses
- [ ] Verify sync status shows "synced" (green badge)
- [ ] Verify address details are correct

### Address Creation (Offline)
- [ ] Turn on airplane mode
- [ ] Open create-address form
- [ ] Fill in all required fields
- [ ] Verify offline geocoding works (if data packs installed)
- [ ] Submit address
- [ ] Verify address appears in my-addresses
- [ ] Verify sync status shows "pending" (orange badge)
- [ ] Turn off airplane mode
- [ ] Wait for sync (check sync indicator)
- [ ] Verify sync status changes to "synced"
- [ ] Verify address appears on server

### Address Editing
- [ ] Open existing address
- [ ] Edit business name/alias
- [ ] Save changes
- [ ] Verify changes saved locally
- [ ] Verify sync status shows "pending"
- [ ] Wait for sync
- [ ] Verify sync status changes to "synced"
- [ ] Verify changes appear on server

### Address Deletion
- [ ] Delete an address
- [ ] Verify address removed from list
- [ ] Verify sync status shows "pending"
- [ ] Wait for sync
- [ ] Verify address removed from server

---

## Phase 2: Offline Functionality

### Multiple Offline Addresses
- [ ] Turn on airplane mode
- [ ] Create 5 addresses offline
- [ ] Verify all show "pending" status
- [ ] Verify all appear in my-addresses list
- [ ] Turn off airplane mode
- [ ] Wait for all to sync
- [ ] Verify all show "synced" status
- [ ] Verify sync queue is empty
- [ ] Verify all addresses on server

### Extended Offline Period
- [ ] Create 10 addresses offline
- [ ] Keep device offline for 1 hour
- [ ] Create 5 more addresses
- [ ] Turn on network
- [ ] Verify all 15 addresses sync
- [ ] Verify no data loss
- [ ] Verify sync order is correct

### Offline Geocoding
- [ ] Install data pack for test region
- [ ] Turn on airplane mode
- [ ] Open create-address form
- [ ] Enter coordinates in data pack region
- [ ] Verify geocoding works offline
- [ ] Verify address components populated
- [ ] Verify house number calculated (if street data available)
- [ ] Submit address
- [ ] Verify address created successfully

### Offline Map Tiles
- [ ] Download map tiles for test region
- [ ] Turn on airplane mode
- [ ] Open map view
- [ ] Navigate to cached region
- [ ] Verify map tiles load from cache
- [ ] Verify no "Access blocked" errors
- [ ] Verify map is usable offline

---

## Phase 3: Sync Functionality

### Automatic Sync on Network Connect
- [ ] Create 3 addresses offline
- [ ] Turn on network
- [ ] Verify sync starts automatically
- [ ] Verify sync indicator shows progress
- [ ] Verify all addresses sync
- [ ] Verify sync indicator shows "synced"

### Background Sync
- [ ] Create address offline
- [ ] Minimize app (background)
- [ ] Turn on network
- [ ] Wait 15+ minutes
- [ ] Reopen app
- [ ] Verify address synced
- [ ] Verify sync happened in background

### Sync Queue Processing
- [ ] Create 20 addresses offline
- [ ] Turn on network
- [ ] Monitor sync queue
- [ ] Verify addresses sync one by one
- [ ] Verify no duplicates
- [ ] Verify all sync successfully
- [ ] Verify sync queue is empty

### Sync Retry Logic
- [ ] Create address offline
- [ ] Turn on network with poor connection
- [ ] Start sync
- [ ] Interrupt network mid-sync
- [ ] Turn network back on
- [ ] Verify sync retries automatically
- [ ] Verify address eventually syncs
- [ ] Verify exponential backoff working

### Sync Status Filtering
- [ ] Create mix of synced and pending addresses
- [ ] Open my-addresses
- [ ] Test "All" filter
- [ ] Test "Synced" filter (only synced addresses)
- [ ] Test "Pending" filter (only pending addresses)
- [ ] Test "Conflict" filter (if conflicts exist)
- [ ] Verify filter works correctly

---

## Phase 4: Data Pack Functionality

### Data Pack Download
- [ ] Open data pack management (if available)
- [ ] View available packs
- [ ] Download pack for test region
- [ ] Verify download progress shown
- [ ] Verify pack installs successfully
- [ ] Verify pack appears in installed list

### Data Pack Usage
- [ ] Use downloaded pack for geocoding
- [ ] Verify geocoding works with pack data
- [ ] Verify street data available
- [ ] Verify house number calculation works
- [ ] Verify admin boundaries resolved
- [ ] Verify settlement places resolved

### Data Pack Deletion
- [ ] Delete installed pack
- [ ] Verify pack removed
- [ ] Verify pack data removed from database
- [ ] Verify geocoding falls back gracefully

### Multiple Data Packs
- [ ] Install 2-3 packs for different regions
- [ ] Test geocoding in each region
- [ ] Verify correct pack data used
- [ ] Verify no conflicts between packs

---

## Phase 5: Network Interruptions

### Interrupt During Sync
- [ ] Create address offline
- [ ] Start sync
- [ ] Turn off network mid-sync
- [ ] Verify sync pauses
- [ ] Turn network back on
- [ ] Verify sync resumes
- [ ] Verify address syncs successfully

### Interrupt During Download
- [ ] Start data pack download
- [ ] Turn off network mid-download
- [ ] Verify download pauses
- [ ] Turn network back on
- [ ] Verify download resumes or restarts
- [ ] Verify pack installs successfully

### Interrupt During API Call
- [ ] Create address online
- [ ] Start API call
- [ ] Turn off network mid-call
- [ ] Verify error handled gracefully
- [ ] Verify address queued for retry
- [ ] Turn network back on
- [ ] Verify address syncs

### Poor Network Conditions
- [ ] Use slow/unstable network
- [ ] Create multiple addresses
- [ ] Verify sync handles timeouts
- [ ] Verify retry logic works
- [ ] Verify no data loss

---

## Phase 6: Large Data Scenarios

### Large Address List
- [ ] Create 100+ addresses
- [ ] Open my-addresses
- [ ] Verify list loads quickly (<2 seconds)
- [ ] Test scrolling performance
- [ ] Test search functionality
- [ ] Test filter functionality
- [ ] Verify no memory issues

### Large Data Pack
- [ ] Download large data pack (>50MB)
- [ ] Verify download progress accurate
- [ ] Verify pack installs successfully
- [ ] Verify database performance
- [ ] Verify geocoding performance
- [ ] Verify no crashes

### Many Pending Sync Items
- [ ] Create 50 addresses offline
- [ ] Turn on network
- [ ] Monitor sync queue
- [ ] Verify all sync successfully
- [ ] Verify no performance degradation
- [ ] Verify UI remains responsive

---

## Phase 7: Conflict Scenarios

### Concurrent Edits
- [ ] Create address on device A
- [ ] Sync to server
- [ ] Edit same address on device B
- [ ] Sync device B
- [ ] Edit same address on device A
- [ ] Sync device A
- [ ] Verify conflict detected
- [ ] Verify conflict badge shown
- [ ] Verify user can resolve conflict

### Server-Side Conflicts
- [ ] Create address offline
- [ ] Server creates same address
- [ ] Sync local address
- [ ] Verify conflict detected
- [ ] Verify conflict resolution works

### Duplicate Addresses
- [ ] Create address at location
- [ ] Try to create another at same location
- [ ] Verify duplicate warning shown
- [ ] Verify user can proceed or cancel
- [ ] Verify no duplicate created if cancelled

---

## Phase 8: App State Handling

### App Restart During Sync
- [ ] Create address offline
- [ ] Start sync
- [ ] Force close app
- [ ] Reopen app
- [ ] Verify sync queue persists
- [ ] Verify sync resumes
- [ ] Verify address syncs

### Background/Foreground Transitions
- [ ] Create address offline
- [ ] Minimize app
- [ ] Wait 5 minutes
- [ ] Reopen app
- [ ] Verify address still pending
- [ ] Turn on network
- [ ] Minimize app again
- [ ] Wait for sync
- [ ] Reopen app
- [ ] Verify address synced

### App Kill During Operations
- [ ] Start address creation
- [ ] Kill app mid-creation
- [ ] Reopen app
- [ ] Verify no corrupted data
- [ ] Verify can create address again

### App Update During Offline
- [ ] Create addresses offline
- [ ] Update app
- [ ] Verify addresses preserved
- [ ] Verify sync works after update

---

## Phase 9: Performance Testing

### Database Performance
- [ ] Create 100 addresses
- [ ] Measure query time (<200ms)
- [ ] Test complex queries
- [ ] Verify index performance
- [ ] Verify no slow queries

### Geocoding Performance
- [ ] Test reverse geocoding speed (<500ms)
- [ ] Test with data packs (<500ms)
- [ ] Test without data packs (<1000ms)
- [ ] Test house number calculation (<200ms)
- [ ] Verify acceptable performance

### Sync Performance
- [ ] Create 20 addresses offline
- [ ] Measure sync time (<1s per item)
- [ ] Verify background sync non-blocking
- [ ] Verify UI remains responsive
- [ ] Verify no battery drain

### UI Performance
- [ ] Test list scrolling (smooth)
- [ ] Test map rendering (smooth)
- [ ] Test form interactions (responsive)
- [ ] Verify no lag or jank
- [ ] Verify memory usage acceptable

---

## Phase 10: Edge Cases

### Empty Database
- [ ] Fresh install
- [ ] Verify app works with no data
- [ ] Verify no crashes
- [ ] Verify can create first address

### Invalid Coordinates
- [ ] Try to create address with invalid lat/lng
- [ ] Verify validation works
- [ ] Verify error message shown
- [ ] Verify can correct and proceed

### Very Long Text Fields
- [ ] Enter very long street name (200+ chars)
- [ ] Enter very long business name (200+ chars)
- [ ] Verify fields handle long text
- [ ] Verify database stores correctly
- [ ] Verify display works

### Special Characters
- [ ] Enter Unicode characters
- [ ] Enter emojis
- [ ] Enter special symbols
- [ ] Verify all stored correctly
- [ ] Verify display works

### Low Storage
- [ ] Fill device storage
- [ ] Try to create address
- [ ] Verify error handled gracefully
- [ ] Verify helpful error message

### Low Memory
- [ ] Open many screens
- [ ] Create many addresses
- [ ] Verify no crashes
- [ ] Verify memory managed properly

---

## Phase 11: Integration Testing

### Complete User Flow
- [ ] Install app
- [ ] Create account/login
- [ ] Download data pack
- [ ] Create 5 addresses offline
- [ ] Edit 2 addresses
- [ ] Delete 1 address
- [ ] Turn on network
- [ ] Verify all sync
- [ ] Verify all on server
- [ ] Verify app state correct

### Offline-to-Online Transition
- [ ] Start offline
- [ ] Create 10 addresses
- [ ] Edit 3 addresses
- [ ] Delete 2 addresses
- [ ] Turn on network
- [ ] Verify all operations sync
- [ ] Verify sync order correct
- [ ] Verify no duplicates
- [ ] Verify no data loss

### Multi-Day Offline
- [ ] Create 20 addresses offline
- [ ] Keep offline for 7+ days
- [ ] Create 10 more addresses
- [ ] Turn on network
- [ ] Verify all 30 addresses sync
- [ ] Verify no corruption
- [ ] Verify all data intact

---

## Bug Reporting

For each bug found, document:
- [ ] Bug description
- [ ] Steps to reproduce
- [ ] Expected behavior
- [ ] Actual behavior
- [ ] Device/OS information
- [ ] App version
- [ ] Screenshots/videos
- [ ] Logs/console output
- [ ] Priority (Critical/High/Medium/Low)

---

## Sign-Off

- [ ] All critical tests passed
- [ ] All high-priority tests passed
- [ ] Known issues documented
- [ ] Performance acceptable
- [ ] Ready for production

**Tester Name**: _________________  
**Date**: _________________  
**App Version**: _________________  
**Device**: _________________  
**OS Version**: _________________
