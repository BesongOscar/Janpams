import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

const maxSizeInBytes = 2 * 1024 * 1024; // 2MB

export const manipulateImage = async (uri: string) => {
  let imageUri = uri;

  // Get file info to check size
  const fileInfo = await FileSystem.getInfoAsync(imageUri);

  if (!fileInfo.exists) {
    throw new Error(`File does not exist:  ${imageUri}`);
  }

  if (fileInfo.size > maxSizeInBytes) {
    // Compress if over 2MB
    const compressed = await compressImage(imageUri);

    const compressedInfo = await FileSystem.getInfoAsync(compressed.uri);

    if (!compressedInfo.exists) {
      throw new Error(`File does not exist:  ${compressed.uri}`);
    }

    // If still too big, compress further recursively or warn
    if (compressedInfo.size > maxSizeInBytes) {
      // Optional: compress again or alert user
      throw new Error(
        `Still too large after compression: ${compressedInfo.size}`,
      );
    }

    imageUri = compressed.uri;
  }

  // Now imageUri is your final file to upload
  return imageUri;
};

export async function compressImage(
  uri: string,
): Promise<{ uri: string; width: number; height: number }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [], // No transformations needed for compression
    {
      compress: 0.5, // 50% JPEG quality
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    },
  );

  return result; // contains uri, width, height, (and base64 if requested)
}
