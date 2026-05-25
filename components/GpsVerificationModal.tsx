import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import * as Location from 'expo-location';

interface GpsVerificationModalProps {
  visible: boolean;
  onVerified: (accuracy: number) => void;
  onCancel: () => void;
  onProceedAnyway?: () => void;
}

type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor';

const QUALITY_CONFIG: Record<QualityLevel, { label: string; color: string; icon: string }> = {
  excellent: { label: 'Excellent', color: '#16A34A', icon: 'signal-cellular-3' },
  good: { label: 'Good', color: '#22C55E', icon: 'signal-cellular-2' },
  fair: { label: 'Fair', color: '#F59E0B', icon: 'signal-cellular-1' },
  poor: { label: 'Poor', color: '#DC2626', icon: 'signal-cellular-outline' },
};

const GOOD_THRESHOLD = 15;
const AUTO_PROCEED_DELAY = 1500;

function classifyAccuracy(accuracy: number): QualityLevel {
  if (accuracy <= 5) return 'excellent';
  if (accuracy <= 15) return 'good';
  if (accuracy <= 30) return 'fair';
  return 'poor';
}

export const GpsVerificationModal: React.FC<GpsVerificationModalProps> = ({
  visible,
  onVerified,
  onCancel,
  onProceedAnyway,
}) => {
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [checking, setChecking] = useState(true);
  const autoProceedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setAccuracy(null);
      setChecking(true);
      if (autoProceedTimer.current) clearTimeout(autoProceedTimer.current);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        if (cancelled) return;
        const acc = loc.coords.accuracy ?? 999;
        setAccuracy(acc);
        setChecking(false);

        if (acc <= GOOD_THRESHOLD) {
          autoProceedTimer.current = setTimeout(() => {
            if (!cancelled) onVerified(acc);
          }, AUTO_PROCEED_DELAY);
        }
      } catch {
        if (!cancelled) {
          setAccuracy(999);
          setChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (autoProceedTimer.current) clearTimeout(autoProceedTimer.current);
    };
  }, [visible, onVerified]);

  const quality = accuracy != null ? classifyAccuracy(accuracy) : null;
  const cfg = quality ? QUALITY_CONFIG[quality] : null;
  const isPoor = quality === 'poor' || quality === 'fair';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Icon source="crosshairs-gps" size={24} color={Colors.primary[500]} />
            <Text style={styles.title}>GPS Verification</Text>
          </View>

          {checking ? (
            <View style={styles.body}>
              <ActivityIndicator size="large" color={Colors.primary[500]} />
              <Text style={styles.checkingText}>Getting GPS fix...</Text>
            </View>
          ) : (
            <View style={styles.body}>
              {/* Accuracy display */}
              <View style={[styles.qualityBadge, { backgroundColor: cfg!.color + '18' }]}>
                <Icon source={cfg!.icon} size={20} color={cfg!.color} />
                <Text style={[styles.qualityLabel, { color: cfg!.color }]}>{cfg!.label}</Text>
              </View>
              <Text style={styles.accuracyText}>
                Accuracy: ±{Math.round(accuracy!)}m
              </Text>

              {isPoor && (
                <Text style={styles.warningText}>
                  GPS accuracy is poor. For better address quality, wait for a stronger signal or move to an open area.
                </Text>
              )}

              {!isPoor && (
                <Text style={styles.successText}>
                  GPS signal is good. Proceeding automatically...
                </Text>
              )}

              {/* Actions */}
              <View style={styles.actions}>
                <Pressable style={styles.cancelBtn} onPress={onCancel}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                {isPoor && onProceedAnyway && (
                  <Pressable style={styles.proceedBtn} onPress={onProceedAnyway}>
                    <Text style={styles.proceedBtnText}>Proceed Anyway</Text>
                  </Pressable>
                )}
                {isPoor && (
                  <Pressable
                    style={styles.retryBtn}
                    onPress={() => {
                      setChecking(true);
                      setAccuracy(null);
                    }}
                  >
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 360,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
  },
  body: {
    alignItems: 'center',
    gap: 12,
  },
  checkingText: {
    fontSize: 14,
    color: Colors.grey,
    fontFamily: 'gentium',
    marginTop: 8,
  },
  qualityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  qualityLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  accuracyText: {
    fontSize: 14,
    color: Colors.dark[10],
    fontFamily: 'gentium',
  },
  warningText: {
    fontSize: 13,
    color: '#B45309',
    fontFamily: 'gentium',
    textAlign: 'center',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
  },
  successText: {
    fontSize: 13,
    color: '#16A34A',
    fontFamily: 'gentium',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors['grey-93'],
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: 'gentium',
    color: Colors.dark[10],
  },
  proceedBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
  },
  proceedBtnText: {
    fontSize: 14,
    fontFamily: 'gentium',
    fontWeight: '600',
    color: '#B45309',
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.primary[500],
  },
  retryBtnText: {
    fontSize: 14,
    fontFamily: 'gentium',
    fontWeight: '600',
    color: '#fff',
  },
});

export default GpsVerificationModal;
