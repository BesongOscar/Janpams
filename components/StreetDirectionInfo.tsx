/**
 * Street Direction Info
 *
 * Displays current direction lock status (unlocked / locked, as_is / reversed).
 * Data from store (activeStreetDirectionLock). No override UI in v1.
 *
 * Phase 6: Street direction UI — offline first.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from 'react-native-paper';
import { useMapStore } from '@/lib/store/mapStore';
import { Colors } from '@/constants';

export function StreetDirectionInfo() {
  const activeStreetDirectionLock = useMapStore((s) => s.activeStreetDirectionLock);
  const activeStreet = useMapStore((s) => s.activeStreet);

  // Only show when we have an active street context (street or lock)
  if (!activeStreet && !activeStreetDirectionLock) return null;

  const isLocked = activeStreetDirectionLock?.directionState === 'locked';
  const direction = activeStreetDirectionLock?.lockedDirection ?? 'as_is';

  const directionLabel = isLocked
    ? direction === 'as_is'
      ? 'Original'
      : 'Reversed'
    : 'Unlocked';

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.labelRow}>
          {isLocked ? (
            <Icon source="lock" size={16} color={Colors.warning} />
          ) : (
            <Icon source="lock-open" size={16} color={Colors.grey} />
          )}
          <Text style={styles.label}>Direction</Text>
        </View>
        <View style={[styles.badge, isLocked && styles.badgeLocked]}>
          <Text style={[styles.badgeText, isLocked && styles.badgeTextLocked]}>
            {directionLabel}
          </Text>
        </View>
      </View>
      {isLocked && activeStreetDirectionLock?.lockedAt && (
        <Text style={styles.detail}>
          Locked: {new Date(activeStreetDirectionLock.lockedAt).toLocaleDateString()}
          {activeStreetDirectionLock.lockSource === 'auto_on_first_address'
            ? ' · Auto (first address)'
            : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: Colors.light.grey,
    borderWidth: 1,
    borderColor: Colors.grey,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors['grey-dark'],
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.light['0'],
  },
  badgeLocked: {
    backgroundColor: Colors.primary['50'],
  },
  badgeText: {
    fontSize: 12,
    color: Colors['grey-dark'],
  },
  badgeTextLocked: {
    color: Colors.primary['500'],
    fontWeight: '600',
  },
  detail: {
    marginTop: 6,
    fontSize: 11,
    color: Colors.grey,
  },
});
