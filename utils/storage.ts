import AsyncStorage from '@react-native-async-storage/async-storage';

export const storeData = async (key: string, data: unknown) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    throw `Error saving data ${error}`;
  }
};

export const readData = async (key: string) => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      return JSON.parse(value);
    }
    return null;
  } catch (error) {
    throw `Error retriving data ${error}`;
  }
};

export const deleteData = async (key: string) => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value === null) {
      return;
    }
    return await AsyncStorage.removeItem(key);
    // throw `No data found with key ${key}`;
  } catch (error) {
    throw `Error deleting data ${error}`;
  }
};

export const clearStorage = async () => {
  try {
    await AsyncStorage.clear();
  } catch (error) {
    throw `Error clearing storage ${error}`;
  }
};
