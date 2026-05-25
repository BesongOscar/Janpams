import React, { FC, useContext, useState, useEffect } from 'react';
import {
  createAddressStyles,
  defaultStyles,
  tabIndexStyles as styles,
} from '@/styles';
import {
  Keyboard,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Button, Dialog, Icon, Snackbar } from 'react-native-paper';
import { Colors } from '@/constants';
import { Loader } from './Loder';
import {
  useAddAliasAddress,
  useUpdateAliasAddress,
} from '@/hooks/addresses.hooks';
import { delay } from '@/utils';
import { Context, ContextType } from '@/app/_layout';
import {
  addressesCheckAddressResponse,
  addressesMyJangoAddress,
} from '@/interfaces';
import i18n from '@/i18n';
import { getAddressDisplayLines, normalizeAddressForDisplay } from '@/utils/addressDisplay';
import { snackbarToast } from '@/utils/toastHelpter';

type Props = {
  onClose: () => void;
  visible: boolean;
  onSuccess?: () => void;
  address:
    | addressesCheckAddressResponse
    | addressesMyJangoAddress
    | {
        longitude?: string | number;
        latitude?: string | number;
        formatted_address?: string;
        address?: {
          business_name?: string;
        };
      }
    | undefined;
  existingAlias?: string; // For editing mode - pre-fill the alias name
  addressId?: string; // For editing mode - the address_book row id to update (My Address Book)
  addressIdForAdd?: string; // When adding from My Addresses: the Jango address id to link
  isEditMode?: boolean; // Flag to indicate if we're editing
};

export const AddAlias: FC<Props> = ({
  onClose,
  visible,
  address,
  onSuccess = () => {},
  existingAlias,
  addressId,
  addressIdForAdd,
  isEditMode = false,
}) => {
  const { lang } = useContext(Context) as ContextType;

  const [alias, setAlias] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  // Pre-fill alias when in edit mode or when existingAlias is provided
  useEffect(() => {
    if (visible && existingAlias) {
      setAlias(existingAlias);
    }
  }, [visible, existingAlias]);

  // Function to clear all input fields and reset states
  const clearAllInputs = () => {
    setAlias(undefined);
    setError(undefined);
  };

  // Enhanced close handler that clears inputs before closing
  const handleClose = () => {
    clearAllInputs();
    onClose();
  };

  // Clear inputs when modal is closed or component unmounts
  useEffect(() => {
    if (!visible) {
      clearAllInputs();
    }
  }, [visible]);

  const handleSave = async () => {
    try {
      setLoading(true);
      
      if (isEditMode && addressId) {
        // Edit mode: addressId is the address_book row id; update alias name only
        const response = await updateMutateAsync({
          id: addressId,
          alias_name: alias ?? '',
        });
        if (
          response.message === 'updated' ||
          response.message?.toLowerCase().includes('success')
        ) {
          snackbarToast(
            i18n.t('(tabs).index.addressUpdatedSuccessfully'),
            'success',
            Colors.success,
          );
          onSuccess();
        } else if (response.message && response.message !== 'not_found') {
          snackbarToast(response.message, 'error', Colors.error);
        }
      } else {
        // Add mode: require alias; use address_id when adding from My Addresses (Address Book flow)
        const longitude =
          typeof address?.longitude === 'string'
            ? parseFloat(address.longitude)
            : (address?.longitude ?? 0);
        const latitude =
          typeof address?.latitude === 'string'
            ? parseFloat(address.latitude)
            : (address?.latitude ?? 0);
        await addMutateAsync({
          alias_name: alias ?? '',
          longitude,
          latitude,
          ...(addressIdForAdd ? { address_id: addressIdForAdd } : {}),
        });
      }
    } catch (error: any) {
      const errorMessage = error?.message || i18n.t('(tabs).index.unknownError');
      snackbarToast(errorMessage, 'error', Colors.error);
    } finally {
      setLoading(false);
      clearAllInputs();
    }
  };

  const { mutateAsync: addMutateAsync } = useAddAliasAddress(
    lang,
    async data => {
      onSuccess();
      if (data.message) {
        snackbarToast(data.message, 'error', Colors.error);
        return;
      }
      //   setShowSuccessModal(true);
    },
    async error => {
      setLoading(false);
      if (typeof error?.response?.data?.message === 'string') {
        // Show the API error message directly to the user
        snackbarToast(error.response.data.message, 'error', Colors.error);
      } else if (
        Array.isArray(error?.response?.data?.message) &&
        typeof error?.response?.data?.message[0] === 'string'
      ) {
        // Show the API error message directly to the user
        snackbarToast(error.response.data.message[0], 'error', Colors.error);
      } else {
        snackbarToast(
          i18n.t('(tabs).index.unknownError'),
          'error',
          Colors.error,
        );
      }
    },
  );

  // Fallback API hook for updating addresses not in local DB
  const { mutateAsync: updateMutateAsync } = useUpdateAliasAddress(
    lang,
    () => {
      onSuccess();
    },
    async error => {
      setLoading(false);
      if (typeof error?.response?.data?.message === 'string') {
        snackbarToast(error.response.data.message, 'error', Colors.error);
      } else if (
        Array.isArray(error?.response?.data?.message) &&
        typeof error?.response?.data?.message[0] === 'string'
      ) {
        snackbarToast(error.response.data.message[0], 'error', Colors.error);
      } else {
        snackbarToast(
          i18n.t('(tabs).index.unknownError'),
          'error',
          Colors.error,
        );
      }
    },
  );

  const displayLines = getAddressDisplayLines(normalizeAddressForDisplay((address as Record<string, unknown>) ?? {}));
  const displayLinesToShow = displayLines.length > 0 ? displayLines : ((address as { formatted_address?: string })?.formatted_address ? [(address as { formatted_address: string }).formatted_address.trim()] : []);

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <>
        <Dialog
          visible={visible}
          onDismiss={() => {}}
          style={styles.dialogContainer}>
          <Dialog.Content
            style={[styles.dialogSubtitleContainer, styles.paddingHorizontal]}>
            <View />
            <Text style={[styles.dialogTitleText, styles.marginLeft]}>
              {isEditMode
                ? i18n.t('(tabs).index.editAddress')
                : i18n.t('(tabs).index.saveAddress')}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Icon source="close" color={Colors.error} size={24} />
            </TouchableOpacity>
          </Dialog.Content>
          <Dialog.Content
            style={[styles.fullWidth, styles.dialogContentcontainer]}>
            {displayLinesToShow.map((line, i) => (
              <Text
                key={i}
                style={[
                  styles.dialogTitle,
                  i === 0 && displayLinesToShow.length > 1 && { fontWeight: '700', fontFamily: 'gentium-bold' },
                ]}>
                {line}
              </Text>
            ))}
          </Dialog.Content>
          <Dialog.Content
            style={[styles.fullWidth, styles.dialogContentcontainer]}>
            <TextInput
              style={[defaultStyles.input, styles.darkWhiteBg]}
              placeholder={i18n.t('(tabs).index.addAlias')}
              value={alias}
              onChangeText={e => setAlias(e)}
            />
          </Dialog.Content>
          <Dialog.Actions
            style={[styles.dialogActionContainer, styles.marginTop]}>
            <Button
              mode="contained"
              textColor={Colors.light['10']}
              buttonColor={Colors.primary[500]}
              style={[defaultStyles.flexButton, styles.shareAddressButton]}
              onPress={handleClose}
              labelStyle={[
                defaultStyles.buttonText,
                styles.shareAddressText,
                createAddressStyles.font14,
              ]}>
              {i18n.t('(tabs).index.cancel')}
            </Button>
            <Button
              mode="contained"
              textColor={Colors.light['10']}
              buttonColor={Colors.primary[500]}
              style={defaultStyles.button}
              onPress={handleSave}
              labelStyle={[
                defaultStyles.buttonText,
                styles.secondaryText,
                createAddressStyles.font14,
              ]}>
              {i18n.t('(tabs).index.save')}
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Snackbar
          visible={!!error}
          onDismiss={() => {}}
          duration={3000}
          style={[defaultStyles.snackbar, defaultStyles.marginBottom]}>
          <Text style={defaultStyles.errorText}>{error}</Text>
        </Snackbar>
        <Loader visible={loading} />
      </>
    </TouchableWithoutFeedback>
  );
};
