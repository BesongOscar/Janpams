/**
 * Ensures expo-localization's LocalizationModule.swift has an exhaustive switch
 * (adds @unknown default for Calendar.Identifier) so it builds with newer Xcode/SDK.
 * Works when the package is hoisted to the monorepo root (patch-package may not find it).
 */
const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const marker = '@unknown default:';

function findExpoLocalization() {
  try {
    const pkgPath = require.resolve('expo-localization/package.json', { paths: [appRoot] });
    return path.join(path.dirname(pkgPath), 'ios', 'LocalizationModule.swift');
  } catch {
    return null;
  }
}

function main() {
  const swiftPath = findExpoLocalization();
  if (!swiftPath || !fs.existsSync(swiftPath)) return;

  let content = fs.readFileSync(swiftPath, 'utf8');
  if (content.includes(marker)) return; // already patched

  // Insert "@unknown default: return \"gregory\"" before the closing "    }" of the calendar switch.
  // The switch ends with "    case .iso8601:\n      return \"iso8601\"\n    }\n  }"
  const oldBlock = `    case .iso8601:
      return "iso8601"
    }
  }`;
  const newBlock = `    case .iso8601:
      return "iso8601"
    @unknown default:
      return "gregory"
    }
  }`;

  if (!content.includes(oldBlock)) {
    console.warn('[patch-expo-localization-swift] Could not find insertion point in LocalizationModule.swift');
    return;
  }
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync(swiftPath, content, 'utf8');
  console.log('[patch-expo-localization-swift] Patched LocalizationModule.swift for exhaustive switch');
}

main();
