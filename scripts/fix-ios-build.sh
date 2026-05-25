#!/usr/bin/env bash
# Fix iOS build: "malformed or corrupted AST file" / EXJavaScriptValue.h not found
# Run from repo root or from apps/core/address-maker-glopams

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_NAME="jango"

echo "→ Cleaning Xcode DerivedData for ${PROJECT_NAME}..."
DERIVED_ROOT="${HOME}/Library/Developer/Xcode/DerivedData"
if [ -d "$DERIVED_ROOT" ]; then
  # Remove only this project's DerivedData to avoid full Xcode re-index
  for dir in "$DERIVED_ROOT"/${PROJECT_NAME}-*; do
    if [ -d "$dir" ]; then
      rm -rf "$dir"
      echo "  Removed: $dir"
    fi
  done
else
  echo "  DerivedData not found at $DERIVED_ROOT"
fi

echo "→ Cleaning iOS build artifacts..."
if [ -d "$APP_DIR/ios" ]; then
  rm -rf "$APP_DIR/ios/build"
  rm -rf "$APP_DIR/ios/Pods"
  rm -f "$APP_DIR/ios/Podfile.lock"
  echo "  Cleaned ios/build, Pods, Podfile.lock"
fi

echo "→ Reinstalling CocoaPods..."
if [ -d "$APP_DIR/ios" ]; then
  (cd "$APP_DIR/ios" && pod install)
  echo "  Pod install done."
else
  echo "  No ios/ folder. Run: npx expo prebuild --platform ios"
fi

echo ""
echo "Done. Next: open Xcode or run 'pnpm ios' again."
