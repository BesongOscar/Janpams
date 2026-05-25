# Build Fixes for expo-sqlite Issues

## Issues Found

### 1. Android Build Error
```
Plugin [id: 'expo-module-gradle-plugin'] was not found
```

### 2. iOS Build Error
```
cannot find 'Constant' in scope (SQLiteModule.swift:32:5)
```

### 3. Version Mismatch
- **Installed**: `expo-sqlite@^16.0.10`
- **Expected for Expo SDK 52**: `expo-sqlite@~15.1.4`

## Solution Applied

### Step 1: Fixed Package Version
Updated `package.json`:
```json
"expo-sqlite": "~15.1.4"
```

### Step 2: Reinstalled Package
```bash
npm install expo-sqlite@~15.1.4
```

## Next Steps

### Option A: Clean Rebuild (Recommended)
```bash
# Clean native folders
rm -rf android ios

# Regenerate native code
npx expo prebuild

# For iOS
cd ios && pod install && cd ..

# Build
npx expo run:android
# or
npx expo run:ios
```

### Option B: If Prebuild Fails
If `expo prebuild` fails with the package.json error, try:

1. **Manual Android Fix**:
   ```bash
   cd android
   ./gradlew clean
   ./gradlew app:assembleDebug
   ```

2. **Manual iOS Fix**:
   ```bash
   cd ios
   pod deintegrate
   pod install
   ```

### Option C: Use EAS Build
If local builds continue to fail:
```bash
eas build --platform android --profile development
eas build --platform ios --profile development
```

## Verification

After fixing, verify:
- [ ] Android build succeeds
- [ ] iOS build succeeds
- [ ] Database operations work
- [ ] No runtime errors related to SQLite

## If Issues Persist

1. **Check Expo SDK Version**:
   ```bash
   npx expo --version
   ```

2. **Verify All Expo Packages**:
   ```bash
   npx expo install --check
   ```

3. **Clear Caches**:
   ```bash
   npm cache clean --force
   rm -rf node_modules
   npm install
   ```

4. **Check Expo Modules**:
   Ensure `expo-modules-autolinking` is working:
   ```bash
   npx expo-modules-autolinking resolve
   ```

## Notes

- The `expo-module-gradle-plugin` should be automatically provided by Expo's autolinking
- The `Constant` function in iOS should be available from `ExpoModulesCore`
- If these are missing, it indicates a version mismatch or incomplete installation
