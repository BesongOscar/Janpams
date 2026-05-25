import {
  ConfigPlugin,
  withProjectBuildGradle,
} from '@expo/config-plugins';

/**
 * Forces a modern CMake version for all Android modules.
 *
 * Why: on Windows, some native modules (notably `expo-sqlite` arm64-v8a) can fail with
 * `ninja: manifest 'build.ninja' still dirty after 100 tries` when using older SDK CMake.
 *
 * This plugin ensures a consistent CMake version is selected during `npx expo prebuild --clean`,
 * so the strict workflow (`npx expo start` + `npx expo run:android`) remains reliable.
 */
export const withAndroidCmakeVersion: ConfigPlugin<{ version: string }> = (
  config,
  { version },
) => {
  return withProjectBuildGradle(config, (c) => {
    if (c.modResults.language !== 'groovy') return c;

    const marker = 'cmake { version';
    if (c.modResults.contents.includes(marker)) return c;

    c.modResults.contents += `

// Added by withAndroidCmakeVersion (strict workflow)
subprojects { p ->
  p.plugins.withId("com.android.application") {
    try {
      p.android {
        externalNativeBuild { cmake { version "${version}" } }
      }
    } catch (Throwable ignored) { }
  }
  p.plugins.withId("com.android.library") {
    try {
      p.android {
        externalNativeBuild { cmake { version "${version}" } }
      }
    } catch (Throwable ignored) { }
  }
}
`;

    return c;
  });
};

