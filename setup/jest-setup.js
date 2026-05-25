/* eslint-disable no-undef */
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('react-native-paper', () => {
  const React = require('react');
  return {
    ...jest.requireActual('react-native-paper'),
    Icon: ({ source }) => React.createElement(React.Fragment, null, source), // Simple mock
  };
});

jest.mock('@expo/vector-icons', () => {
  return {
    MaterialIcons: () => 'MockedMaterialIcon',
  };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn().mockReturnValue({
    push: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: jest.fn().mockReturnValue({
    requestId: '12345',
    email: 'test@example.com',
    password: 'password123',
    phoneNumber: '+1234567890',
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(),
}));
