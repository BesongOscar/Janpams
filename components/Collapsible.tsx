import { Colors } from '@/constants';
import { defaultStyles } from '@/styles';
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  LayoutAnimation,
} from 'react-native';
import { IconButton } from 'react-native-paper';

interface Props {
  title: string;
  height: number;
  children: React.ReactNode;
}

export const Collapsible: React.FC<Props> = ({ title, children, height }) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const animation = useRef(new Animated.Value(0)).current;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    Animated.timing(animation, {
      toValue: expanded ? 0 : height, // Expand to content height
      duration: 300,
      useNativeDriver: false,
    }).start();

    setExpanded(!expanded);
  };

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <TouchableOpacity onPress={toggleExpand} style={styles.header}>
        <Text style={defaultStyles.headerText}>{title}</Text>
        <IconButton
          icon={expanded ? 'chevron-up' : 'chevron-down'}
          size={28}
          iconColor={Colors.primary[500]}
        />
      </TouchableOpacity>

      {/* Measure and Animate Content */}
      <Animated.View style={[styles.content, { height: animation }]}>
        <View>{children}</View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    overflow: 'hidden',
  },
});
