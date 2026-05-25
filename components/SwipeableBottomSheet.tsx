import React, { useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SwipeableBottomSheetProps {
  children: React.ReactNode;
  visible: boolean;
  onDismiss: () => void;
  collapsedHeight?: number;
  expandedHeight?: number;
  fullHeight?: number;
  onHeightChange?: (height: number) => void;
}

type SheetState = 'collapsed' | 'expanded' | 'full' | 'dismissed';

export const SwipeableBottomSheet: React.FC<SwipeableBottomSheetProps> = ({
  children,
  visible,
  onDismiss,
  collapsedHeight = 120,
  expandedHeight = SCREEN_HEIGHT * 0.5,
  fullHeight = SCREEN_HEIGHT * 0.8,
  onHeightChange,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(collapsedHeight);
  const [currentState, setCurrentState] = React.useState<SheetState>('dismissed');
  const tabBarHeight = 48; // Tab bar height from styles

  // Calculate actual heights
  const actualCollapsedHeight = collapsedHeight;
  const actualExpandedHeight = expandedHeight;
  const actualFullHeight = fullHeight;

  const notifyHeightChange = useCallback(
    (height: number) => {
      onHeightChange?.(height);
    },
    [onHeightChange],
  );

  useEffect(() => {
    if (visible) {
      // Animate to collapsed state when visible
      translateY.value = withSpring(0, {
        damping: 10,
        stiffness: 50,
      });
      setCurrentState('collapsed');
      notifyHeightChange(actualCollapsedHeight);
    } else {
      // Animate to dismissed (off screen)
      translateY.value = withSpring(actualCollapsedHeight, {
        damping: 10,
        stiffness: 50,
      });
      setCurrentState('dismissed');
      notifyHeightChange(0);
    }
  }, [visible, actualCollapsedHeight, translateY, notifyHeightChange]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10]) // Only activate when vertical movement exceeds 10px
    .failOffsetX([-10, 10]) // Fail if horizontal movement exceeds 10px (allows map panning)
    .minPointers(1)
    .maxPointers(1)
    .onUpdate(e => {
      'worklet';
      const newY = Math.max(
        -(actualFullHeight - actualCollapsedHeight),
        Math.min(0, e.translationY),
      );
      translateY.value = newY;
    })
    .onEnd(e => {
      'worklet';
      const currentY = translateY.value;
      const velocity = e.velocityY;

      // Calculate thresholds
      const expandedY = -(actualExpandedHeight - actualCollapsedHeight);
      const fullY = -(actualFullHeight - actualCollapsedHeight);

      // Determine target state based on current position and velocity
      let targetState: SheetState = 'collapsed';
      let targetY = 0;
      let finalHeight = actualCollapsedHeight;

      if (velocity > 1000) {
        // Fast swipe down - dismiss
        targetState = 'dismissed';
        targetY = actualCollapsedHeight;
        finalHeight = 0;
      } else if (velocity < -1000) {
        // Fast swipe up - go to next state
        if (currentY > expandedY / 2) {
          targetState = 'expanded';
          targetY = expandedY;
          finalHeight = actualExpandedHeight;
        } else {
          targetState = 'full';
          targetY = fullY;
          finalHeight = actualFullHeight;
        }
      } else {
        // Slow drag - snap to nearest state
        if (currentY > expandedY / 2) {
          targetState = 'collapsed';
          targetY = 0;
          finalHeight = actualCollapsedHeight;
        } else if (currentY > (expandedY + fullY) / 2) {
          targetState = 'expanded';
          targetY = expandedY;
          finalHeight = actualExpandedHeight;
        } else {
          targetState = 'full';
          targetY = fullY;
          finalHeight = actualFullHeight;
        }
      }

      translateY.value = withSpring(targetY, {
        damping: 10,
        stiffness: 50,
      });

      // Update state and notify height change on JS thread
      runOnJS(setCurrentState)(targetState);
      runOnJS(notifyHeightChange)(finalHeight);

      // If dismissed, call onDismiss
      if (targetState === 'dismissed') {
        runOnJS(onDismiss)();
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  if (!visible && currentState === 'dismissed') {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: actualFullHeight,
        },
        animatedStyle,
      ]}
      pointerEvents="box-none">
      <GestureDetector gesture={panGesture}>
        <View 
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + tabBarHeight, // Safe area + tab bar height
            }
          ]} 
          pointerEvents="auto">
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer} pointerEvents="auto">
            <View style={styles.dragHandle} />
          </View>

          {/* Content */}
          <View style={styles.content} pointerEvents="auto">{children}</View>
        </View>
      </GestureDetector>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  sheet: {
    backgroundColor: Colors.light[10],
    // borderTopLeftRadius: 20,
    // borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
    flex: 1,
    overflow: 'hidden',
    minHeight: '100%',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.dark['0.2'],
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 1,
  },
});

