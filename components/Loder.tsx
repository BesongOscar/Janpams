import { Colors } from '@/constants';
import React, { FC } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Modal } from 'react-native-paper';
import { loaderStyles as styles } from '@/styles';
import i18n from '@/i18n';

type Props = {
  text?: string;
  visible: boolean;
};
export const Loader: FC<Props> = ({
  text = i18n.t('(auth).login.pleaseWait'),
  visible,
}) => {
  return (
    <Modal visible={visible} style={styles.modal}>
      <View style={styles.container}>
        <ActivityIndicator
          color={Colors.light['10']}
          style={styles.indicator}
        />
        <Text style={styles.text}>{text}</Text>
      </View>
    </Modal>
  );
};
