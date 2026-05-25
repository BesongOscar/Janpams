/**
 * NavigationErrorCard — displays a user-facing error card when navigation fails.
 * Reads the session failure from the Zustand navigation store, maps it to a
 * localised message, and shows an actionable CTA.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import i18n from '@/i18n';
import type { NavigationFailureCode } from '@janpams/core/navigation';
import {
  getNavigationErrorMeta,
  getActionI18nKey,
  type SuggestedAction,
} from '@/lib/navigation/errors/navigationErrors';

interface NavigationErrorCardProps {
  failureCode: NavigationFailureCode;
  failureMessage?: string;
  onDismiss: () => void;
  onRetry?: () => void;
  onDownloadPack?: () => void;
  onSwitchProfile?: () => void;
}

export function NavigationErrorCard({
  failureCode,
  failureMessage,
  onDismiss,
  onRetry,
  onDownloadPack,
  onSwitchProfile,
}: NavigationErrorCardProps) {
  const meta = getNavigationErrorMeta(failureCode);

  if (failureCode === 'CANCELLED') return null;

  // Show a user-friendly message instead of raw "Native module not linked" / JNI errors (Android)
  const isEngineUnavailableError =
    failureMessage &&
    /native module not linked|JNI bridge|Phase 1|engine.*not.*available/i.test(
      failureMessage.trim(),
    );

  const friendlyEngineMessage = i18n.t('(tabs).navigation.error.engineUnavailableOnDevice', {
    defaultValue:
      'In-app turn-by-turn is not available on this device. Use "Open in another app" to navigate with Google Maps or another app.',
  });

  const message =
    (isEngineUnavailableError ? friendlyEngineMessage : null) ??
    (meta.i18nKey ? i18n.t(meta.i18nKey) : null) ??
    failureMessage ??
    i18n.t('(tabs).navigation.error.unknown');

  const actionLabel = getActionI18nKey(meta.suggestedAction);

  const handleAction = () => {
    const actions: Record<SuggestedAction, (() => void) | undefined> = {
      download_pack: onDownloadPack,
      switch_profile: onSwitchProfile,
      enable_location: () => {
        if (Platform.OS === 'ios') {
          Linking.openURL('app-settings:');
        } else {
          Linking.openSettings();
        }
      },
      retry: onRetry,
      none: undefined,
    };
    actions[meta.suggestedAction]?.();
  };

  const showAction = meta.suggestedAction !== 'none' && actionLabel;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Icon
            source={meta.icon}
            size={28}
            color={meta.severity === 'blocking' ? '#B71C1C' : Colors.primary[500]}
          />
          <Text style={styles.message}>{message}</Text>
        </View>

        <View style={styles.actions}>
          {showAction && (
            <TouchableOpacity style={styles.actionButton} onPress={handleAction}>
              <Text style={styles.actionButtonText}>{i18n.t(actionLabel)}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissButtonText}>
              {i18n.t('common.back', { defaultValue: 'Dismiss' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 100,
    paddingHorizontal: 16,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  message: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.dark[0],
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary[500],
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light[0],
  },
  dismissButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.light[10],
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.grey,
  },
});
