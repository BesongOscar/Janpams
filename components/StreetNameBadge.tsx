import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { detectNamingMode, getModeBadge, type StreetNamingMode } from '@/lib/streetValidation';

interface StreetNameBadgeProps {
  streetName: string;
  size?: 'small' | 'default';
}

const MODE_COLORS: Record<StreetNamingMode, string> = {
  Standard: '#22C55E',
  Numeric: '#3B82F6',
  Landmark: '#F59E0B',
  Custom: '#6B7280',
};

export const StreetNameBadge: React.FC<StreetNameBadgeProps> = ({
  streetName,
  size = 'default',
}) => {
  const namingMode = useMemo(() => detectNamingMode(streetName), [streetName]);
  const badge = useMemo(() => getModeBadge(namingMode), [namingMode]);
  const color = MODE_COLORS[namingMode];
  const isSmall = size === 'small';

  if (!streetName.trim()) return null;

  return (
    <View style={[styles.badge, { backgroundColor: color + '18' }, isSmall && styles.badgeSmall]}>
      <View style={[styles.dot, { backgroundColor: color }, isSmall && styles.dotSmall]} />
      <Text style={[styles.label, { color }, isSmall && styles.labelSmall]}>
        {badge.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 5,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelSmall: {
    fontSize: 10,
  },
});

export default StreetNameBadge;
