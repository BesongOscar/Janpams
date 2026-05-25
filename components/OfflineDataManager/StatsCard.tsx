import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';

interface StatsCardProps {
  icon: string;
  value: number;
  label: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ icon, value, label }) => {
  return (
    <TouchableOpacity style={styles.mainContainer} >
      <Text style={styles.value}>{value.toLocaleString()}</Text>
          <Icon source={icon} size={12} color={Colors.primary[500]} />
          <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    width: '24%',
    backgroundColor: '#F4F5F7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  container: {
    alignContent: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
    marginBottom: 2,
    textAlign: 'center',
  },
  label: {
    fontSize: 11,
    color: Colors.grey,
    fontFamily: 'gentium',
  },
});
