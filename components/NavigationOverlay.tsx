/**
 * Live navigation overlay: ETA, remaining distance, current step, off-route, reroute, voice, follow map, Stop.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import i18n from '@/i18n';
import { speakInstruction, speakArrival, setVoiceMuted, isVoiceMuted } from '@/lib/navigation/voiceGuidance';

export interface RouteStepDisplay {
  instruction?: string;
  distance?: number;
}

interface NavigationOverlayProps {
  formattedETA: string;
  formattedDistance: string;
  currentStepIndex: number;
  progress: number;
  steps?: RouteStepDisplay[];
  offRouteAction: { type: string; message?: string } | null;
  onStop: () => void;
  /** When provided and user is off-route, show Reroute button. */
  onReroute?: () => void;
  /** Follow map centered on user. Parent uses this to animate map. */
  followMap?: boolean;
  onFollowMapChange?: (enabled: boolean) => void;
  /** Arrival signalled externally (e.g. from NavigationCore). Takes precedence over progress-based detection. */
  arrived?: boolean;
}

const COMPACT_WIDTH = 380;
const ARRIVAL_PROGRESS_THRESHOLD = 0.95;

export function NavigationOverlay({
  formattedETA,
  formattedDistance,
  currentStepIndex,
  progress,
  steps = [],
  offRouteAction,
  onStop,
  onReroute,
  followMap = true,
  onFollowMapChange,
  arrived = false,
}: NavigationOverlayProps) {
  const { width } = useWindowDimensions();
  const compact = width < COMPACT_WIDTH;
  const currentStep = steps[currentStepIndex];
  const isOffRoute = offRouteAction && offRouteAction.type !== 'none';
  const canReroute = isOffRoute && (offRouteAction.type === 'reroute' || offRouteAction.type === 'warn') && onReroute != null;

  const [voiceMuted, setVoiceMutedState] = useState(isVoiceMuted());
  const lastStepIndexRef = useRef<number>(-1);
  const hasSpokenArrivalRef = useRef(false);

  const hasArrived = arrived || progress >= ARRIVAL_PROGRESS_THRESHOLD;

  // Voice: speak when step changes (uses app locale for TTS)
  const ttsLanguage = (typeof i18n.language === 'string' ? i18n.language.split('-')[0] : 'en') || 'en';
  useEffect(() => {
    const instruction = currentStep?.instruction ?? i18n.t('(tabs).navigation.followTheRoute');
    if (currentStepIndex !== lastStepIndexRef.current) {
      lastStepIndexRef.current = currentStepIndex;
      if (!voiceMuted) speakInstruction(instruction, { language: ttsLanguage });
    }
  }, [currentStepIndex, currentStep?.instruction, voiceMuted, ttsLanguage]);

  // Voice: speak arrival (from either progress threshold or external signal), then auto-stop
  useEffect(() => {
    if (hasArrived && !hasSpokenArrivalRef.current) {
      hasSpokenArrivalRef.current = true;
      if (!voiceMuted) speakArrival(i18n.t('(tabs).navigation.youHaveArrived'), { language: ttsLanguage });
      const arrivalTimer = setTimeout(() => onStop(), 2500);
      return () => clearTimeout(arrivalTimer);
    }
  }, [hasArrived, voiceMuted, ttsLanguage, onStop]);

  const toggleVoice = () => {
    const next = !voiceMuted;
    setVoiceMutedState(next);
    setVoiceMuted(next);
  };

  const toggleFollow = () => {
    onFollowMapChange?.(!followMap);
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={[styles.card, compact && styles.cardCompact]}>
        {/* Current instruction */}
        <View style={[styles.instructionRow, compact && styles.instructionRowCompact]}>
          <Icon source="navigation-variant" size={compact ? 20 : 24} color={Colors.primary[500]} />
          <Text style={[styles.instructionText, compact && styles.instructionTextCompact]} numberOfLines={2}>
            {currentStep?.instruction ?? i18n.t('(tabs).navigation.followTheRoute')}
          </Text>
        </View>

        {/* ETA & remaining distance */}
        <View style={[styles.statsRow, compact && styles.statsRowCompact]}>
          <View style={styles.stat}>
            <Text style={[styles.statLabel, compact && styles.statLabelCompact]}>
              {i18n.t('(tabs).navigation.eta')}
            </Text>
            <Text style={[styles.statValue, compact && styles.statValueCompact]}>{formattedETA || '--'}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statLabel, compact && styles.statLabelCompact]}>
              {i18n.t('(tabs).navigation.remaining')}
            </Text>
            <Text style={[styles.statValue, compact && styles.statValueCompact]}>{formattedDistance || '--'}</Text>
          </View>
        </View>

        {/* Off-route warning + Reroute */}
        {isOffRoute && (
          <View style={[styles.offRouteBanner, compact && styles.offRouteBannerCompact]}>
            <Icon source="alert" size={compact ? 18 : 20} color={Colors.light[0]} />
            <Text style={[styles.offRouteText, compact && styles.offRouteTextCompact]}>
              {offRouteAction.message ?? i18n.t('(tabs).navigation.youAreOffRoute')}
            </Text>
          </View>
        )}
        {canReroute && (
          <TouchableOpacity style={[styles.rerouteButton, compact && styles.stopButtonCompact]} onPress={onReroute}>
            <Icon source="redo" size={compact ? 18 : 20} color={Colors.light[0]} />
            <Text style={[styles.rerouteButtonText, compact && styles.stopButtonTextCompact]}>
              {i18n.t('(tabs).navigation.reroute')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Follow map + Voice toggle row */}
        <View style={styles.togglesRow}>
          {onFollowMapChange != null && (
            <TouchableOpacity style={styles.toggleChip} onPress={toggleFollow}>
              <Icon source={followMap ? 'crosshairs-gps' : 'map-marker'} size={18} color={followMap ? Colors.primary[500] : Colors.grey} />
              <Text style={[styles.toggleChipText, followMap && styles.toggleChipTextActive]}>
                {i18n.t('(tabs).navigation.followMap')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.toggleChip} onPress={toggleVoice}>
            <Icon source={voiceMuted ? 'volume-off' : 'volume-high'} size={18} color={voiceMuted ? Colors.grey : Colors.primary[500]} />
            <Text style={[styles.toggleChipText, !voiceMuted && styles.toggleChipTextActive]}>
              {voiceMuted ? i18n.t('(tabs).navigation.voiceMuted') : i18n.t('(tabs).navigation.voiceOn')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stop navigation */}
        <TouchableOpacity style={[styles.stopButton, compact && styles.stopButtonCompact]} onPress={onStop}>
          <Icon source="stop" size={compact ? 18 : 20} color={Colors.light[0]} />
          <Text style={[styles.stopButtonText, compact && styles.stopButtonTextCompact]}>
            {i18n.t('(tabs).navigation.stopNavigation')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 12,
    zIndex: 1000,
  },
  card: {
    backgroundColor: Colors.light[0],
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark[0],
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.grey,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark[0],
  },
  offRouteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#B71C1C',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  offRouteText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light[0],
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.grey,
    paddingVertical: 12,
    borderRadius: 10,
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light[0],
  },
  // Compact layout for small screens
  containerCompact: {
    paddingHorizontal: 12,
    paddingBottom: 16,
    paddingTop: 8,
  },
  cardCompact: {
    padding: 12,
    borderRadius: 12,
  },
  instructionRowCompact: {
    marginBottom: 8,
  },
  instructionTextCompact: {
    fontSize: 14,
  },
  statsRowCompact: {
    gap: 16,
    marginBottom: 8,
  },
  statLabelCompact: {
    fontSize: 11,
  },
  statValueCompact: {
    fontSize: 16,
  },
  offRouteBannerCompact: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  offRouteTextCompact: {
    fontSize: 13,
  },
  rerouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary[500],
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  rerouteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light[0],
  },
  togglesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.light[10],
  },
  toggleChipText: {
    fontSize: 13,
    color: Colors.grey,
  },
  toggleChipTextActive: {
    color: Colors.primary[500],
    fontWeight: '600',
  },
  stopButtonCompact: {
    paddingVertical: 10,
  },
  stopButtonTextCompact: {
    fontSize: 14,
  },
});
