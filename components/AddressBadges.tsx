import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';

export type AddressSource = 'jango' | 'osm_offline' | 'osm_online' | 'external';
export type AddressQuality = 'HIGH' | 'MEDIUM' | 'LOW';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

interface SourceBadgeProps {
  source: AddressSource;
}

const SOURCE_CONFIG: Record<AddressSource, { label: string; color: string; bg: string; icon: string }> = {
  jango: { label: 'JanGo', color: '#7C3AED', bg: '#EDE9FE', icon: 'database' },
  osm_offline: { label: 'OSM Offline', color: '#0369A1', bg: '#E0F2FE', icon: 'cloud-off-outline' },
  osm_online: { label: 'OSM Online', color: '#0891B2', bg: '#CFFAFE', icon: 'cloud-check-outline' },
  external: { label: 'External', color: '#6B7280', bg: '#F3F4F6', icon: 'open-in-new' },
};

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source }) => {
  const cfg = SOURCE_CONFIG[source];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Icon source={cfg.icon} size={12} color={cfg.color} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

interface QualityIndicatorProps {
  quality?: AddressQuality | string | null | undefined;
}

const QUALITY_CONFIG: Record<AddressQuality, { label: string; color: string; bg: string }> = {
  HIGH: { label: 'High Quality', color: '#16A34A', bg: '#DCFCE7' },
  MEDIUM: { label: 'Medium Quality', color: '#CA8A04', bg: '#FEF9C3' },
  LOW: { label: 'Low Quality', color: '#DC2626', bg: '#FEE2E2' },
};

const DEFAULT_QUALITY: AddressQuality = 'MEDIUM';

function normalizeQuality(q: unknown): AddressQuality {
  if (q === 'HIGH' || q === 'MEDIUM' || q === 'LOW') return q;
  const s = typeof q === 'string' ? q.toUpperCase() : '';
  if (s === 'HIGH' || s === 'MEDIUM' || s === 'LOW') return s as AddressQuality;
  return DEFAULT_QUALITY;
}

export const QualityIndicator: React.FC<QualityIndicatorProps> = ({ quality }) => {
  const key = normalizeQuality(quality);
  const cfg = QUALITY_CONFIG[key];
  if (!cfg) return null;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.qualityDot, { backgroundColor: cfg.color }]} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

interface VerificationBadgeProps {
  status: VerificationStatus;
}

const VERIFICATION_CONFIG: Record<VerificationStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'Pending', color: '#CA8A04', bg: '#FEF9C3', icon: 'clock-outline' },
  verified: { label: 'Verified', color: '#16A34A', bg: '#DCFCE7', icon: 'check-circle-outline' },
  rejected: { label: 'Rejected', color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline' },
};

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({ status }) => {
  const cfg = VERIFICATION_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Icon source={cfg.icon} size={12} color={cfg.color} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
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
    gap: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  qualityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
