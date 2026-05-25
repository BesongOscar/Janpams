import React, {
  Dispatch,
  FC,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  createAddressStyles,
  defaultStyles,
  tabIndexStyles as styles,
} from '@/styles';
import {
  Keyboard,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Button, Dialog, Icon } from 'react-native-paper';
import { Colors, STREET_TYPES } from '@/constants';
import { InputComponent } from './Input';
import { Context, ContextType } from '@/app/_layout';
import i18n from '@/i18n';
import {
  buildStreetTypeOptions,
  formatStreetName,
  reverseFormatStreetName,
} from '@/utils';

type Props = {
  onClose: () => void;
  visible: boolean;
  setStreet: Dispatch<SetStateAction<string | undefined>>;
  setStreetType: Dispatch<SetStateAction<string>>;
  defaultStreetName?: string;
};

export const EditStreet: FC<Props> = ({
  onClose,
  visible,
  setStreet,
  setStreetType,
  defaultStreetName,
}) => {
  const { lang } = useContext(Context) as ContextType;

  const [streetName, setStreetName] = useState<string>();
  const [streetTypeState, setStreetTypeState] = useState<string>();
  const [showError, setShowError] = useState(false);

  const options = buildStreetTypeOptions(STREET_TYPES);

  // Function to clear all input fields and reset states
  const clearAllInputs = () => {
    setStreetName(undefined);
    setStreetTypeState(undefined);
    setShowError(false);
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

  useEffect(() => {
    const reverseStreet = reverseFormatStreetName(
      defaultStreetName ?? '',
      lang,
      STREET_TYPES,
    );
    setStreetName(reverseStreet.name);
    if (reverseStreet?.type) setStreetTypeState(reverseStreet?.type);
  }, [defaultStreetName]);

  const onSave = () => {
    setShowError(true);
    if (!(streetName && streetTypeState)) return;
    const formattedStreet = formatStreetName(
      streetName ?? '',
      streetTypeState ?? '',
      lang,
      STREET_TYPES,
    );
    setStreet(formattedStreet);
    setStreetType(streetTypeState);
    clearAllInputs();
    onClose();
  };

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
              {i18n.t('components.editStreet.editStreet')}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Icon source="close" color={Colors.error} size={24} />
            </TouchableOpacity>
          </Dialog.Content>
          <Dialog.Content
            style={[styles.fullWidth, styles.dialogContentcontainer]}>
            <InputComponent
              icon={require('@/assets/images/ic_street.png')}
              title1={i18n.t('components.editStreet.streetName')}
              value1={streetName}
              placeHolder1={i18n.t('components.editStreet.enterStreetName')}
              setValue1={setStreetName}
              showError={showError && !streetName}
              error={i18n.t('components.editStreet.pleaseEnterStreet')}
              containerStyle={styles.inputContainerStyle}
            />
          </Dialog.Content>
          <Dialog.Content style={styles.dialogContentcontainer}>
            <InputComponent
              icon={require('@/assets/images/ic_street.png')}
              title1={i18n.t('components.editStreet.streetType')}
              placeHolder1={i18n.t('components.editStreet.selectStreetType')}
              value1={streetTypeState}
              setValue1={setStreetTypeState}
              options1={options[lang]}
              showError={showError && !streetTypeState}
              error={i18n.t('components.editStreet.pleaseSelect')}
              containerStyle={styles.inputContainerStyle}
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
              {i18n.t('components.editStreet.close')}
            </Button>
            <Button
              mode="contained"
              textColor={Colors.light['10']}
              buttonColor={Colors.primary[500]}
              style={defaultStyles.button}
              onPress={onSave}
              labelStyle={[
                defaultStyles.buttonText,
                styles.secondaryText,
                createAddressStyles.font14,
              ]}>
              {i18n.t('components.editStreet.done')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </>
    </TouchableWithoutFeedback>
  );
};
