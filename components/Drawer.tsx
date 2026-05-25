import React, {
  FC,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  TouchableOpacity,
  Animated,
  Dimensions,
  View,
  GestureResponderEvent,
  SafeAreaView,
  Image,
  Text,
} from 'react-native';
import { drawerStyles as styles, tabIndexStyles } from '@/styles';
import { Dialog, Icon, Portal } from 'react-native-paper';
import { Colors } from '@/constants';
import { deleteData, performLogout, triggerLogoutNavigation } from '@/utils';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import i18n from '@/i18n';
import { useLogout } from '@/hooks/users.hooks';
import { Context, ContextType } from '@/app/_layout';
import { useRouter } from 'expo-router';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_DRAWER_WIDTH = 262; // Maximum width constraint
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.9, MAX_DRAWER_WIDTH); // 90% of screen width but max 262px

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface NavigationItemProps {
  icon: ReactNode;
  text: string;
  onPress: () => void;
}

const NavigationItem: FC<NavigationItemProps> = ({ icon, text, onPress }) => {
  return (
    <TouchableOpacity style={styles.navigationItem} onPress={onPress}>
      {icon}
      <Text style={styles.navItemText}>{text}</Text>
    </TouchableOpacity>
  );
};

export const Drawer: FC<Props> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { lang } = useContext(Context) as ContextType;

  const drawerRef = useRef<View>(null);

  const closeButtonRef = useRef<View>(null);

  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current; // Start off-screen

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: isOpen ? 0 : -DRAWER_WIDTH, // Slide in or out
      duration: 500, // 2-second animation
      useNativeDriver: true, // Optimize animation performance
    }).start();
  }, [isOpen]);

  const handlePressOutside = (e: GestureResponderEvent) => {
    if (!drawerRef.current) return;

    const touchX = e.nativeEvent.pageX;
    const touchY = e.nativeEvent.pageY;

    // 1️⃣ Check if click is inside the close button
    if (closeButtonRef.current) {
      closeButtonRef.current.measure((x, y, width, height, pageX, pageY) => {
        const isOnCloseButton =
          touchX >= pageX &&
          touchX <= pageX + width &&
          touchY >= pageY &&
          touchY <= pageY + height;

        if (isOnCloseButton) {
          onClose();
          return; // Exit early since we already handled it
        }
      });
    }

    // 2️⃣ Check if click is outside the drawer
    drawerRef.current.measure((x, y, width, height, pageX, pageY) => {
      const isOutside =
        touchX < pageX ||
        touchX > pageX + width ||
        touchY < pageY ||
        touchY > pageY + height;

      if (isOutside) {
        onClose();
      }
    });
  };

  const handleLogout = async () => {
    try {
      setShowLogoutModal(false);
      try {
        await logoutAsync();
      } catch {
        // Backend logout may fail (e.g. offline); still clear local state
      }
      await performLogout();
      await deleteData('@currentCoordinates');
      triggerLogoutNavigation();
    } catch {
      // Ensure we still navigate out on error
      triggerLogoutNavigation();
    } finally {
      await GoogleSignin.signOut();
    }
  };

  const { mutateAsync: logoutAsync } = useLogout(lang, () => {}, () => {});

  return (
    <>
      {isOpen && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={e => handlePressOutside(e)}
        />
      )}
      {isOpen && (
        <Animated.View
          style={[styles.drawer, { transform: [{ translateX }] }]}
          ref={drawerRef}>
          <SafeAreaView style={styles.mainContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              ref={closeButtonRef}>
              <Icon source={'close'} size={24} color={Colors.dark[0]} />
            </TouchableOpacity>
            <View style={styles.iconContainer}>
              <Image source={require('@/assets/images/jango_icon.png')} />
            </View>
            <View style={styles.navContainer}>
              <View style={styles.topNavItemsContainer}>
                <NavigationItem
                  onPress={() => router.push('/profile')}
                  text={i18n.t('components.drawer.profile')}
                  icon={
                    <Icon
                      source={'account-outline'}
                      size={16}
                      color={Colors.dark[0]}
                    />
                  }
                />
                <NavigationItem
                  onPress={() => router.push('/my-addresses')}
                  text={i18n.t('components.drawer.addresses')}
                  icon={
                    <Icon
                      source={'map-marker-radius-outline'}
                      size={16}
                      color={Colors.dark[0]}
                    />
                  }
                />
                <View style={styles.divider} />
              </View>
              <View style={styles.bottomNavItemsContainer}>
                <NavigationItem
                  onPress={() => router.push('/notifications')}
                  text={i18n.t('components.drawer.notifications')}
                  icon={
                    <Icon
                      source={'bell-badge-outline'}
                      size={16}
                      color={Colors.dark[0]}
                    />
                  }
                />
                <NavigationItem
                  onPress={() => router.push('/settings')}
                  text={i18n.t('components.drawer.settings')}
                  icon={
                    <Icon
                      source={'cog-outline'}
                      size={16}
                      color={Colors.dark[0]}
                    />
                  }
                />
                <NavigationItem
                  onPress={() => router.push('/help')}
                  text={i18n.t('components.drawer.help')}
                  icon={
                    <Icon
                      source={'help-circle-outline'}
                      size={16}
                      color={Colors.dark[0]}
                    />
                  }
                />
                <NavigationItem
                  onPress={() => setShowLogoutModal(true)}
                  text={i18n.t('components.drawer.logout')}
                  icon={
                    <Icon source={'logout'} size={16} color={Colors.dark[0]} />
                  }
                />
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}

      <Portal>
        <Dialog
          visible={showLogoutModal}
          onDismiss={() => {}}
          style={tabIndexStyles.dialogContainer}>
          <Dialog.Content style={styles.dialogSubtitleContainer}>
            <Icon source={'alert-outline'} color={Colors.error} size={24} />
            <Text style={styles.logoutHeadingText}>
              {i18n.t('components.drawer.logout')}
            </Text>
          </Dialog.Content>
          <Dialog.Content>
            <Text style={styles.logoutSubHeading}>
              {i18n.t('components.drawer.areYouSure')}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActionContainer}>
            <TouchableOpacity
              style={styles.buttonContainer}
              onPress={() => setShowLogoutModal(false)}>
              <Text style={styles.linkText}>
                {i18n.t('components.drawer.no')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.buttonContainer}
              onPress={handleLogout}>
              <Text style={styles.linkText}>
                {i18n.t('components.drawer.yes')}
              </Text>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
};
