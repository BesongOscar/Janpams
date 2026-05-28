import React, { useContext, useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Text, View, SafeAreaView, Image, Dimensions } from 'react-native';
import { tabLayoutStyles as styles } from '@/styles';

import i18n from '../../i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Context, SessionContext } from '../_layout';
import { useBottomSheet } from '@/contexts/BottomSheetContext';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang, user } = useContext(Context)!;
  const sessionCtx = useContext(SessionContext);
  const isAuthLoading = sessionCtx?.isAuthLoading ?? true;
  const { hideTabBar } = useBottomSheet();

  // Protected route gate: redirect to login if not authenticated and auth state is resolved
  useEffect(() => {
    if (!isAuthLoading && (user == null || user === undefined)) {
      router.replace('/(auth)/login');
    }
  }, [isAuthLoading, user, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.tabBar,
          {
            bottom: insets.bottom,
          },
          hideTabBar ? { display: 'none' as const } : undefined,
        ].filter(Boolean),
      }}
      initialRouteName="index">
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <SafeAreaView>
              <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
                <Image
                  source={require('@/assets/images/house_black.png')}
                  style={[
                    styles.tabIconImage,
                    focused && styles.tabIconImageFocused,
                  ]}
                  resizeMode="contain"
                />
                <Text
                  key={lang}
                  style={[styles.tabText, focused && styles.tabTextFocused]}>
                  {i18n.t('(tabs)._layout.getAddress')}
                </Text>
              </View>
            </SafeAreaView>
          ),
        }}
      />
      <Tabs.Screen
        name="route-directions"
        options={{
          tabBarIcon: ({ focused }) => (
            <SafeAreaView>
              <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
                <Image
                  source={require('@/assets/images/directions_blue.png')}
                  style={[
                    styles.tabIconImage,
                    focused && styles.tabIconImageFocused,
                  ]}
                  resizeMode="contain"
                />
                <Text
                  key={lang}
                  style={[styles.tabText, focused && styles.tabTextFocused]}>
                  {i18n.t('(tabs)._layout.getDirections')}
                </Text>
              </View>
            </SafeAreaView>
          ),
        }}
      />
    </Tabs>
  );
}
