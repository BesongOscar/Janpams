import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  TouchableOpacity,
  ScrollView,
  BackHandler,
  // Linking,
} from 'react-native';
import { defaultStyles, myAddressesStyles as styles } from '@/styles';
import { Appbar, Icon, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants';
import i18n from '@/i18n';
import { useGetUserNotifications } from '@/hooks/users.hooks';
import { Context, ContextType } from './_layout';
import { delay } from '@/utils';
import { Loader } from '@/components';

export default function Notifications() {
  const router = useRouter();
  const { user, lang } = useContext(Context) as ContextType;
  const [error, setError] = useState<string>();

  const {
    data,
    isLoading,
    error: getNotificationsError,
  } = useGetUserNotifications(lang, !!user?.id);

  useEffect(() => {
    const getError = async () => {
      if (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof (getNotificationsError as any)?.response?.data?.message ===
        'string'
      ) {
        setError(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          `${(getNotificationsError as any)?.response?.data?.message}`,
        );
        await delay(5000);
        setError(undefined);
      } else if (
        Array.isArray(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (getNotificationsError as any)?.response?.data?.message,
        ) &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof (getNotificationsError as any)?.response?.data?.message[0] ===
          'string'
      ) {
        setError(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          `${(getNotificationsError as any)?.response?.data?.message[0]}`,
        );
        await delay(5000);
        setError(undefined);
      } else {
        setError(`${i18n.t('my-addresses.unknownError')}}`);
        await delay(5000);
        setError(undefined);
      }
    };
    if (getNotificationsError) {
      getError();
    }
  }, [getNotificationsError]);

  // This use effect listens to every back action and routes to the tabs screen
  useEffect(() => {
    const backAction = () => {
      router.replace('/(tabs)');
      return true; // prevent default back behavior
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, []);
  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={24}>
        <View style={defaultStyles.flex}>
          <Appbar.Header
            dark={false}
            style={[defaultStyles.appHeader, styles.headerContainer]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={defaultStyles.backButtonContainer}>
              <Icon source={'arrow-left'} size={24} color={Colors.light[10]} />
            </TouchableOpacity>
            <View style={defaultStyles.headerTextContainer}>
              <Text style={[defaultStyles.headerText, styles.headerText]}>
                {i18n.t('notifications.notifications')}
              </Text>
            </View>
          </Appbar.Header>
          <ScrollView
            style={[defaultStyles.scrollContainer, styles.marginVertical24]}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled">
            {data?.data?.length && data?.data?.length > 0 ? (
              data?.data?.map((item, index) => {
                return (
                  <TouchableOpacity
                    style={styles.notificationItem}
                    key={index}
                    // onPress={() =>
                    //   item?.associated_data
                    //     ? Linking.openURL(item?.associated_data)
                    //     : {}
                    // }
                  >
                    <Text style={styles.notificationHeading}>
                      {item.notification_type}
                    </Text>
                    <Text style={styles.notificationText}>{item.message}</Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View
                style={[
                  styles.container,
                  styles.noAddressFoundContainer,
                  defaultStyles.paddingBottom,
                ]}>
                <Text style={styles.noAddressFoundText}>
                  {i18n.t('notifications.noNewNotifications')}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <Snackbar
        visible={!!error}
        onDismiss={() => {}}
        duration={3000}
        style={defaultStyles.snackbar}>
        <Text style={defaultStyles.errorText}>{error}</Text>
      </Snackbar>
      <Loader
        visible={isLoading}
        text={`${i18n.t('my-addresses.pleaseWait')}...`}
      />
    </>
  );
}
