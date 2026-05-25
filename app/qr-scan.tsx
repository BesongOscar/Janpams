/**
 * QR Scan Screen — scans JanPAMS QR codes and launches navigation.
 *
 * Flow: Camera → scan QR → parse → show destination card → "Start Navigation" → navigate to route-directions.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import i18n from '@/i18n';
import { parseQrPayload } from '@janpams/core/qr';
import type {
  SupportedQrPayload,
  QrDestinationPayload,
  QrVerificationPayload,
} from '@janpams/core/navigation';

type ScanState =
  | { type: 'scanning' }
  | { type: 'parsed'; payload: SupportedQrPayload }
  | { type: 'invalid'; raw: string }
  | { type: 'no_permission' };

export default function QrScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>({ type: 'scanning' });
  const scanLockRef = useRef(false);

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;

      const payload = parseQrPayload(data);
      if (payload) {
        setScanState({ type: 'parsed', payload });
      } else {
        setScanState({ type: 'invalid', raw: data });
      }
    },
    [],
  );

  const handleRetry = () => {
    scanLockRef.current = false;
    setScanState({ type: 'scanning' });
  };

  const getDestinationInfo = (payload: SupportedQrPayload) => {
    if (payload.type === 'JANPAMS_DEST') {
      const p = payload as QrDestinationPayload;
      return {
        lat: p.lat,
        lon: p.lon,
        label: p.label ?? `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`,
      };
    }
    const p = payload as QrVerificationPayload;
    return {
      lat: p.dest.lat,
      lon: p.dest.lon,
      label: p.dest.label ?? `${p.dest.lat.toFixed(5)}, ${p.dest.lon.toFixed(5)}`,
    };
  };

  const handleStartNavigation = () => {
    if (scanState.type !== 'parsed') return;
    const dest = getDestinationInfo(scanState.payload);
    router.push({
      pathname: '/(tabs)/route-directions',
      params: {
        qr_lat: String(dest.lat),
        qr_lon: String(dest.lon),
        qr_label: dest.label,
        qr_payload: JSON.stringify(scanState.payload),
      },
    });
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Icon source="camera-off" size={48} color={Colors.grey} />
        <Text style={styles.permissionText}>
          {i18n.t('qrScan.cameraPermission', {
            defaultValue: 'Camera permission is required to scan QR codes.',
          })}
        </Text>
        {permission.canAskAgain && (
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>
              {i18n.t('qrScan.grantPermission', { defaultValue: 'Grant permission' })}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>
            {i18n.t('common.back', { defaultValue: 'Back' })}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {scanState.type === 'scanning' && (
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarCodeScanned}
        />
      )}

      <SafeAreaView style={styles.overlay}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon source="arrow-left" size={24} color={Colors.light[0]} />
          </TouchableOpacity>
          <Text style={styles.title}>
            {i18n.t('qrScan.title', { defaultValue: 'Scan QR Code' })}
          </Text>
          <View style={styles.backButton} />
        </View>

        {/* Scanning overlay */}
        {scanState.type === 'scanning' && (
          <View style={styles.scanFrame}>
            <View style={styles.scanBox} />
            <Text style={styles.scanHint}>
              {i18n.t('qrScan.hint', {
                defaultValue: 'Point camera at a JanGo QR code',
              })}
            </Text>
          </View>
        )}

        {/* Invalid QR */}
        {scanState.type === 'invalid' && (
          <View style={styles.resultCard}>
            <Icon source="qrcode-remove" size={36} color="#B71C1C" />
            <Text style={styles.resultTitle}>
              {i18n.t('qrScan.invalidQr', { defaultValue: 'Invalid QR code' })}
            </Text>
            <Text style={styles.resultMessage}>
              {i18n.t('qrScan.invalidQrMessage', {
                defaultValue:
                  'This QR code is not a valid JanGo navigation code. Please try another.',
              })}
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={handleRetry}>
              <Text style={styles.primaryButtonText}>
                {i18n.t('qrScan.scanAgain', { defaultValue: 'Scan again' })}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Parsed destination */}
        {scanState.type === 'parsed' && (() => {
          const dest = getDestinationInfo(scanState.payload);
          return (
            <View style={styles.resultCard}>
              <Icon source="map-marker-check" size={36} color={Colors.primary[500]} />
              <Text style={styles.resultTitle}>
                {i18n.t('qrScan.destinationFound', { defaultValue: 'Destination found' })}
              </Text>
              <Text style={styles.destinationLabel}>{dest.label}</Text>
              <Text style={styles.destinationCoords}>
                {dest.lat.toFixed(5)}, {dest.lon.toFixed(5)}
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={handleStartNavigation}>
                <Icon source="navigation" size={20} color={Colors.light[0]} />
                <Text style={styles.primaryButtonText}>
                  {i18n.t('(tabs).navigation.startNavigation')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
                <Text style={styles.secondaryButtonText}>
                  {i18n.t('qrScan.scanAgain', { defaultValue: 'Scan again' })}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })()}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.light[0],
    gap: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light[0],
  },
  scanFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBox: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: Colors.primary[500],
    borderRadius: 16,
  },
  scanHint: {
    marginTop: 16,
    fontSize: 15,
    color: Colors.light[0],
    textAlign: 'center',
  },
  resultCard: {
    margin: 16,
    backgroundColor: Colors.light[0],
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark[0],
  },
  resultMessage: {
    fontSize: 14,
    color: Colors.grey,
    textAlign: 'center',
    lineHeight: 20,
  },
  destinationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark[0],
    textAlign: 'center',
  },
  destinationCoords: {
    fontSize: 13,
    color: Colors.grey,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary[500],
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light[0],
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.grey,
  },
  permissionText: {
    fontSize: 16,
    color: Colors.dark[0],
    textAlign: 'center',
    lineHeight: 22,
  },
});
