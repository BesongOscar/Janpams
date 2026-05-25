# Prebuild Checklist

## Pre-Build Steps

### 1. Code Quality
- [ ] All linter errors fixed
- [ ] All TypeScript errors resolved
- [ ] No console.log statements in production code (use console.debug or remove)
- [ ] All TODO comments documented
- [ ] Code follows project style guide

### 2. Dependencies
- [ ] All dependencies up to date
- [ ] No security vulnerabilities (`npm audit`)
- [ ] All patches applied (`patch-package`)
- [ ] Native dependencies properly linked

### 3. Configuration
- [ ] `app.config.ts` updated with correct bundle identifier
- [ ] Environment variables set correctly
- [ ] API endpoints configured
- [ ] Map tile URLs configured
- [ ] OSM attribution included

### 4. Database
- [ ] Database schema version correct
- [ ] All migrations tested
- [ ] Indexes created correctly
- [ ] No schema conflicts

### 5. Testing
- [ ] Unit tests pass (`npm test`)
- [ ] Integration tests pass
- [ ] No test failures
- [ ] Test coverage acceptable

### 6. Build Configuration
- [ ] iOS build configuration correct
- [ ] Android build configuration correct
- [ ] App icons and splash screens ready

### 7. Documentation
- [ ] README updated
- [ ] API documentation complete
- [ ] Database schema documented
- [ ] Sync system documented
- [ ] Testing guide complete

## Build Commands

### Development (strict workflow)
```bash
# Metro (development build — not Expo Go; same as `expo start --dev-client`)
pnpm start

# Android emulator or phone (USB)
npx expo run:android
```

### Local Prebuild
```bash
# Clean prebuild
npx expo prebuild --clean

# iOS
cd ios && pod install && cd ..

# Android
# No additional steps needed
```

## Post-Build Verification

### iOS
- [ ] App installs on device/simulator
- [ ] App launches without crashes
- [ ] Database initializes correctly
- [ ] Network requests work
- [ ] Location services work
- [ ] Camera permissions work

### Android
- [ ] App installs on device/emulator
- [ ] App launches without crashes
- [ ] Database initializes correctly
- [ ] Network requests work
- [ ] Location services work
- [ ] Camera permissions work

## Known Issues

Document any known issues before building:
- [ ] Issue 1: [Description]
- [ ] Issue 2: [Description]

## Build Notes

Add any special notes for this build:
- [ ] Note 1: [Description]
- [ ] Note 2: [Description]
