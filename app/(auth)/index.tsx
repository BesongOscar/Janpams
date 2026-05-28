import React, { useContext, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  TouchableOpacity,
  BackHandler,
  ScrollView,
} from 'react-native';
import {
  authIndexStyles as styles,
  defaultStyles,
  loginStyles,
} from '@/styles';
import { Button, Snackbar } from 'react-native-paper';
import { Colors } from '@/constants';
import { useNavigation, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import i18n from '../../i18n';
import { Context, SessionContext } from '../_layout';
import { useSocialAuth } from '@/contexts/SocialAuthContext';
import { Loader } from '@/components';
import GoogleButton from '@/components/socialButtons/GoogleButton';
import FacebookButton from '@/components/socialButtons/FacebookButton';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Index() {
  const router = useRouter();
  const sessionCtx = useContext(SessionContext);
  const { socialLoading, socialError } = useSocialAuth();
  const isLoggedIn = sessionCtx?.isLoggedIn ?? false;

  const navigation = useNavigation();

  const isFocused = useIsFocused(); // Detect if this screen is active

  // This useEffect listens for the navigation action on this screen
  // If the action is a back action, then quit the app
  // This prevents us from going back into the app after logout and also from going back to the splash screen
  // Now, isFocused is used to check if this screen is focused i.e. if you are actually on this screen
  // This is because this use effect will be called on every screen in this stack (because it is dependent on navigation)
  useEffect(() => {
    if (!isFocused || isLoggedIn) return; // Only add listener if screen is focused

    const listener = navigation.addListener('beforeRemove', async e => {
      e.preventDefault();

      if (e.data.action.type === 'GO_BACK') {
        BackHandler.exitApp();
      } else {
        navigation.dispatch(e.data.action);
      }
    });

    return () => {
      listener(); // Remove the listener when component unmounts
    };
  }, [navigation, isFocused, isLoggedIn]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{flex:1}}>
      <KeyboardAvoidingView
        style={defaultStyles.container}
        behavior="padding"
        keyboardVerticalOffset={24}>
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={defaultStyles.mainContainer}>
            <ScrollView
              contentContainerStyle={[styles.scrollContent, { flexGrow: 1, justifyContent: 'flex-end' }]}
              showsVerticalScrollIndicator={false}>
              <View style={styles.appIconContainer}>
                <Image source={require('@/assets/images/jango_icon.png')} />
              </View>
              <View style={styles.illustratorImageContainer}>
                <Image
                  source={require('@/assets/images/location_illustration.png')}
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.headingText}>
                  {i18n.t('(auth).index.heading')}
                </Text>
                <Text style={styles.subheadingText}>
                  {i18n.t('(auth).index.subHeading')}
                </Text>
              </View>

              <View style={styles.actionsContainer}>
                <TouchableOpacity>
                  <Button
                    mode="contained"
                    onPress={() => router.push('/login')}
                    buttonColor={Colors.primary['500']}
                    style={defaultStyles.button}>
                    <Text style={defaultStyles.buttonText}>
                      {i18n.t('(auth).index.login')}
                    </Text>
                  </Button>
                </TouchableOpacity>
                <View style={loginStyles.socialContainer}>
                  <View style={loginStyles.line} />
                  <Text style={loginStyles.socialText}>
                    {i18n.t('(auth).index.continueWithGoogleOrFacebook')}
                  </Text>
                  <View style={loginStyles.line} />
                </View>
                <View style={loginStyles.socialsButtonContainer}>
                  <FacebookButton />
                  <GoogleButton />
                </View>
                <View style={styles.bottomLinkContainer}>
                  <Text> {i18n.t('(auth).index.dontHave')}?</Text>
                  <TouchableOpacity onPress={() => router.push('/signup')}>
                    <Text style={styles.linkText}>{i18n.t('(auth).index.signup')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <Loader
        visible={socialLoading}
        text={i18n.t('(auth).login.pleaseWait')}
      />
      <Snackbar
        visible={!!socialError}
        onDismiss={() => {}}
        duration={3000}
        style={defaultStyles.snackbar}>
        <Text style={defaultStyles.errorText}>{socialError}</Text>
      </Snackbar>
    </SafeAreaView>
  );
}
