import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { useState, useCallback } from 'react';

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export function useCompressedImage(uri: string) {
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const compressImage = useCallback(async (): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || !info.size) {
        throw new Error('File does not exist or is invalid');
      }

      if (info.size <= MAX_SIZE_BYTES) {
        return uri;
      }

      // Use manipulateAsync for compression
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [], // No transformations needed for compression
        {
          compress: 0.5,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      const newInfo = await FileSystem.getInfoAsync(result.uri);
      if (!newInfo.exists || !newInfo.size) {
        throw new Error('Compressed file is invalid');
      }

      if (newInfo.size > MAX_SIZE_BYTES) {
        throw new Error('File is still too large after compression');
      }

      return result.uri;
    } catch (err) {
      setError(err as Error);
      return '';
    } finally {
      setLoading(false);
    }
  }, [uri]);

  return { compressImage, loading, error };
}
