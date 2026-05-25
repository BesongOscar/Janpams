# Mobile App - Monorepo Integration Guide

**Version:** 1.0  
**Date:** 2025-01-21  
**Purpose:** Exact file changes to add Expo React Native app to JanPAMS monorepo

---

## 1. Overview

This guide provides the exact configuration changes needed to integrate an Expo React Native application into the existing JanPAMS pnpm + Turborepo monorepo.

### Current Structure
```
janpams-monorepo/
├── apps/
│   ├── government/
│   ├── banking/{uba,ecobank}/
│   ├── logistics/{dhl,fedex}/
│   └── utilities/{eneo,camwater}/
├── packages/
│   ├── core/
│   ├── types/
│   ├── geospatial-data/
│   └── {industry}-core/
├── pnpm-workspace.yaml
└── turbo.json
```

### Target Structure
```
janpams-monorepo/
├── apps/
│   ├── mobile/                    # NEW: Expo app
│   │   ├── app.config.ts
│   │   ├── package.json
│   │   ├── metro.config.js
│   │   ├── tsconfig.json
│   │   └── src/
│   ├── government/
│   └── ...
├── packages/
│   ├── core/
│   ├── types/
│   ├── mobile-adapters/           # NEW: RN-specific adapters (optional)
│   └── ...
├── pnpm-workspace.yaml            # MODIFIED
└── turbo.json                     # MODIFIED
```

---

## 2. File Changes

### 2.1 pnpm-workspace.yaml

**Current:**
```yaml
packages:
  - 'packages/*'
  - 'apps/government'
  - 'apps/banking/*'
  - 'apps/logistics/*'
  - 'apps/utilities/*'
  - 'tools/*'
```

**Updated:**
```yaml
packages:
  - 'packages/*'
  - 'apps/government'
  - 'apps/banking/*'
  - 'apps/logistics/*'
  - 'apps/utilities/*'
  - 'apps/mobile'              # ADD: Expo mobile app
  - 'tools/*'
```

---

### 2.2 turbo.json

**Current:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "inputs": ["src/**", "tsconfig.json", "package.json"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "*.ts", "*.tsx"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "**/*.test.ts", "**/*.test.tsx"],
      "outputs": ["coverage/**"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Updated:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "inputs": ["src/**", "tsconfig.json", "package.json"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "*.ts", "*.tsx"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "**/*.test.ts", "**/*.test.tsx"],
      "outputs": ["coverage/**"]
    },
    "clean": {
      "cache": false
    },
    
    "mobile:start": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    },
    "mobile:build": {
      "dependsOn": ["^build"],
      "outputs": ["android/app/build/**", "ios/build/**"],
      "inputs": ["src/**", "app.config.ts", "package.json"]
    },
    "mobile:build:preview": {
      "dependsOn": ["^build"],
      "cache": false
    },
    "mobile:build:production": {
      "dependsOn": ["^build"],
      "cache": false
    }
  }
}
```

---

### 2.3 apps/mobile/package.json

**Create new file:**

```json
{
  "name": "@janpams/mobile",
  "version": "0.1.0",
  "private": true,
  "main": "index.ts",
  "scripts": {
    "start": "expo start --dev-client",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "build": "echo 'Use EAS Build for mobile'",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "mobile:start": "expo start --dev-client",
    "mobile:build": "eas build --profile development",
    "mobile:build:preview": "eas build --profile preview",
    "mobile:build:production": "eas build --profile production"
  },
  "dependencies": {
    "@janpams/core": "workspace:*",
    "@janpams/types": "workspace:*",
    
    "expo": "~52.0.0",
    "expo-camera": "~15.0.0",
    "expo-file-system": "~17.0.0",
    "expo-image-picker": "~15.0.0",
    "expo-location": "~17.0.0",
    "expo-secure-store": "~13.0.0",
    "expo-sqlite": "~14.0.0",
    "expo-status-bar": "~2.0.0",
    "expo-background-fetch": "~12.0.0",
    "expo-task-manager": "~12.0.0",
    
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/native-stack": "^6.9.0",
    "@react-navigation/bottom-tabs": "^6.5.0",
    
    "@supabase/supabase-js": "^2.90.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.5.0",
    
    "react": "18.2.0",
    "react-native": "0.74.0",
    "react-native-maps": "^1.8.0",
    "react-native-gesture-handler": "~2.14.0",
    "react-native-reanimated": "~3.6.0",
    "react-native-safe-area-context": "4.8.2",
    "react-native-screens": "~3.29.0"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@types/react": "~18.2.45",
    "typescript": "~5.3.0",
    "eslint": "^8.57.0",
    "jest": "^29.7.0",
    "@testing-library/react-native": "^12.0.0"
  }
}
```

---

### 2.4 apps/mobile/tsconfig.json

**Create new file:**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@janpams/core": ["../../packages/core/src/index.ts"],
      "@janpams/core/*": ["../../packages/core/src/*"],
      "@janpams/types": ["../../packages/types/src/index.ts"],
      "@janpams/types/*": ["../../packages/types/src/*"]
    },
    "types": ["@types/react", "jest"]
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

---

### 2.5 apps/mobile/metro.config.js

**Create new file:**

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project root and workspace root
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force Metro to resolve (sub)dependencies only from the workspace root
config.resolver.disableHierarchicalLookup = true;

// 4. Resolve workspace packages from source
config.resolver.extraNodeModules = {
  '@janpams/core': path.resolve(workspaceRoot, 'packages/core/src'),
  '@janpams/types': path.resolve(workspaceRoot, 'packages/types/src'),
};

// 5. Add support for additional extensions if needed
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

module.exports = config;
```

---

### 2.6 apps/mobile/app.config.ts

**Create new file:**

```typescript
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'JanPAMS',
  slug: 'janpams-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0000FF', // JanPAMS blue
  },
  assetBundlePatterns: ['**/*'],
  
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.janpams.mobile',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'JanPAMS needs your location to create accurate addresses.',
      NSLocationAlwaysAndWhenInUseUsageDescription: 'JanPAMS needs background location for address verification.',
      NSCameraUsageDescription: 'JanPAMS needs camera access to capture property photos.',
      NSPhotoLibraryUsageDescription: 'JanPAMS needs photo library access for profile pictures.',
    },
    associatedDomains: [
      'applinks:*.lovable.app',
      'applinks:janpams.com',
    ],
  },
  
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0000FF',
    },
    package: 'com.janpams.mobile',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'FOREGROUND_SERVICE',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: '*.lovable.app',
            pathPrefix: '/verify',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  
  scheme: 'janpams',
  
  plugins: [
    'expo-location',
    'expo-camera',
    'expo-secure-store',
    [
      'expo-sqlite',
      {
        enableFTS: true, // Enable full-text search
      },
    ],
    'expo-background-fetch',
  ],
  
  extra: {
    eas: {
      projectId: 'your-eas-project-id', // Replace after running eas init
    },
    // Environment variables
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
```

---

### 2.7 apps/mobile/eas.json

**Create new file:**

```json
{
  "cli": {
    "version": ">= 7.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

### 2.8 apps/mobile/.env.example

**Create new file:**

```bash
# Supabase/Lovable Cloud
EXPO_PUBLIC_SUPABASE_URL=https://wlccinbcrddscduaohue.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Environment
EXPO_PUBLIC_ENV=development
```

---

## 3. Directory Structure to Create

```
apps/mobile/
├── app.config.ts
├── eas.json
├── metro.config.js
├── package.json
├── tsconfig.json
├── babel.config.js
├── index.ts
├── .env.example
├── .gitignore
│
├── assets/
│   ├── icon.png                 # 1024x1024
│   ├── splash.png               # 1284x2778
│   └── adaptive-icon.png        # 1024x1024
│
└── src/
    ├── screens/
    │   └── .gitkeep
    ├── components/
    │   └── .gitkeep
    ├── adapters/
    │   └── .gitkeep
    ├── stores/
    │   └── .gitkeep
    ├── navigation/
    │   └── .gitkeep
    ├── hooks/
    │   └── .gitkeep
    └── utils/
        └── .gitkeep
```

---

## 4. Additional Files

### 4.1 apps/mobile/babel.config.js

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // Must be last
    ],
  };
};
```

### 4.2 apps/mobile/index.ts

```typescript
import { registerRootComponent } from 'expo';
import App from './src/App';

registerRootComponent(App);
```

### 4.3 apps/mobile/src/App.tsx (Starter)

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Test import from shared packages
import { encode } from '@janpams/core/pluscode';
import type { GeoPosition } from '@janpams/types';

export default function App() {
  // Test that shared logic works
  const testCode = encode(3.8667, 11.5167, 10);
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>JanPAMS Mobile</Text>
      <Text style={styles.subtitle}>Monorepo Integration Test</Text>
      <Text style={styles.code}>Plus Code: {testCode}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0000FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 24,
  },
  code: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 8,
  },
});
```

### 4.4 apps/mobile/.gitignore

```gitignore
# Dependencies
node_modules/

# Expo
.expo/
dist/
web-build/

# Native builds
ios/
android/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/

# EAS
.easignore
```

---

## 5. Installation Commands

Run these commands from the **monorepo root**:

```bash
# 1. Create the mobile app directory
mkdir -p apps/mobile/src/{screens,components,adapters,stores,navigation,hooks,utils}
mkdir -p apps/mobile/assets

# 2. Create placeholder files
touch apps/mobile/src/screens/.gitkeep
touch apps/mobile/src/components/.gitkeep
touch apps/mobile/src/adapters/.gitkeep
touch apps/mobile/src/stores/.gitkeep
touch apps/mobile/src/navigation/.gitkeep
touch apps/mobile/src/hooks/.gitkeep
touch apps/mobile/src/utils/.gitkeep

# 3. Install dependencies from root
pnpm install

# 4. Navigate to mobile app
cd apps/mobile

# 5. Install Expo CLI globally (if not already)
npm install -g expo-cli eas-cli

# 6. Initialize EAS (creates eas.json)
eas init

# 7. Configure EAS build
eas build:configure

# 8. Create development build
eas build --profile development --platform all
```

---

## 6. Verification Steps

### 6.1 Test Shared Package Imports

```bash
# From apps/mobile
pnpm typecheck
```

Expected: No errors related to `@janpams/core` or `@janpams/types`

### 6.2 Test Metro Bundler

```bash
# From apps/mobile
pnpm start
```

Expected: Metro starts without "Unable to resolve module" errors

### 6.3 Test Turbo Commands

```bash
# From monorepo root
pnpm turbo run typecheck --filter=@janpams/mobile
pnpm turbo run mobile:start --filter=@janpams/mobile
```

Expected: Commands execute correctly

---

## 7. Troubleshooting

### Issue: "Unable to resolve module @janpams/core"

**Solution:** Ensure `metro.config.js` has correct `extraNodeModules` paths:

```javascript
config.resolver.extraNodeModules = {
  '@janpams/core': path.resolve(workspaceRoot, 'packages/core/src'),
  '@janpams/types': path.resolve(workspaceRoot, 'packages/types/src'),
};
```

### Issue: "Duplicate module" errors

**Solution:** Add `disableHierarchicalLookup`:

```javascript
config.resolver.disableHierarchicalLookup = true;
```

### Issue: pnpm symlinks not followed

**Solution:** Add workspace root to `watchFolders`:

```javascript
config.watchFolders = [workspaceRoot];
```

### Issue: TypeScript path aliases not working

**Solution:** Ensure both `tsconfig.json` paths AND `metro.config.js` extraNodeModules are configured.

---

## 8. Package Compatibility Notes

### Packages That Work Directly (Pure TypeScript)

| Package | Import | Notes |
|---------|--------|-------|
| `@janpams/types` | `import type { Address } from '@janpams/types'` | Types only, no runtime |
| `@janpams/core/pluscode` | `import { encode } from '@janpams/core/pluscode'` | Pure math |
| `@janpams/core/address` | `import { formatAddress } from '@janpams/core/address'` | Pure logic |

### Packages Requiring Adapters (Web APIs)

| Package | Web API | RN Replacement |
|---------|---------|----------------|
| `@janpams/core/geolocation` | `navigator.geolocation` | `expo-location` |
| `@janpams/core/offline` | `IndexedDB (idb)` | `expo-sqlite` |
| `@janpams/core/map` | `MapLibre GL JS` | `react-native-maps` |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-21 | JanPAMS Team | Initial version |
