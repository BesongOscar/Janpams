import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Dialog, Button, Icon } from 'react-native-paper';
import Colors from '@/constants/Colors';
import { defaultStyles } from '@/styles';

interface LocationValidationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  reason?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'error' | 'warning' | 'info';
}

/**
 * Dialog component for hard location resets and validation errors
 * Blocking dialog that requires user action
 */
export const LocationValidationDialog: React.FC<
  LocationValidationDialogProps
> = ({
  visible,
  title,
  message,
  reason,
  onConfirm,
  onCancel,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  type = 'warning',
}) => {
  const getIcon = () => {
    switch (type) {
      case 'error':
        return 'alert-circle';
      case 'warning':
        return 'alert';
      case 'info':
        return 'information';
      default:
        return 'alert';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'error':
        return Colors.error;
      case 'warning':
        return Colors.warning || '#FF9800';
      case 'info':
        return Colors.primary[500];
      default:
        return Colors.warning || '#FF9800';
    }
  };

  return (
    <Dialog visible={visible} onDismiss={onCancel} dismissable={!!onCancel}>
      <Dialog.Content style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon source={getIcon()} size={48} color={getIconColor()} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {reason && <Text style={styles.reason}>{reason}</Text>}
      </Dialog.Content>
      <Dialog.Actions style={styles.actions}>
        {onCancel && (
          <Button
            mode="outlined"
            onPress={onCancel}
            textColor={Colors.primary[500]}
            style={styles.cancelButton}>
            {cancelLabel}
          </Button>
        )}
        <Button
          mode="contained"
          onPress={onConfirm}
          buttonColor={Colors.primary[500]}
          textColor={Colors.light[10]}
          style={styles.confirmButton}>
          {confirmLabel}
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark[10],
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'gentium-bold',
  },
  message: {
    fontSize: 14,
    color: Colors.dark[8],
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  reason: {
    fontSize: 12,
    color: Colors.dark[6],
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  cancelButton: {
    borderColor: Colors.primary[500],
  },
  confirmButton: {
    minWidth: 100,
  },
});

