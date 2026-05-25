# Android emulator troubleshooting (strict workflow)

This repo’s supported development workflow is **only**:

- Keep an **Android emulator running**
- Start Metro with **`pnpm start`** from `apps/core/address-maker-glopams` (uses **`expo start --dev-client`**)
- Build/install/run with **`npx expo run:android`**
- Regenerate native project when needed: **`npx expo prebuild --clean`**

This page is troubleshooting for that workflow.

## Developer options does not appear on the main Settings screen

After you tap **Build number** seven times (under **About emulated device**), you should see a toast like “You are now a developer.” That only **unlocks** the menu; **Developer options** is usually **not** a tile on the first Settings page.

**How to open it (API 36 / typical Google emulator image):**

1. **Search:** Open **Settings**, use **Search settings** at the top, type **Developer** or **USB debugging**, then open **Developer options**.
2. **Navigation:** **Settings → System → Developer options** (common on Pixel-style / `sdk_gphone*` images).
3. **Scroll:** On some builds, **Developer options** appears at the **bottom** of the main Settings list after unlock.

The in-app “Settings” is not Android system Settings; use the **Settings** app from the home drawer, or from the host:  
`adb shell am start -a android.settings.SETTINGS`

## Metro: can’t load JS / “Unable to load script” / wrong port

The emulator must reach Metro on the host:

- Start Metro: **`pnpm start`** (development build; not Expo Go)
- Run on emulator: **`npx expo run:android`**
- Confirm **`adb devices`** shows `device` (not `authorizing`). If stuck: cold boot the AVD, or `adb kill-server` then `adb start-server`.

If Metro says port **8081** is already in use, stop the stale process using that port, then re-run **`pnpm start`**.

## Samsung Galaxy Emulator Skin

[Samsung Galaxy Emulator Skin](https://developer.samsung.com/galaxy-emulator-skin) provides **visual skins** (device frames) around the **standard Android Emulator**. It does **not** replace your need for a normal **system image** in Android Studio’s AVD Manager, and it does **not** fix Metro, adb, “Unable to load script,” or ANRs by itself.

Use a skin if you want **look-and-feel** closer to Galaxy hardware for demos or screenshots—not as a debugging fix for bundler connectivity.

## When changing or resetting the emulator makes sense

| Situation | Action |
| --------- | ------ |
| adb stuck, odd state, or `authorizing` forever | **Cold boot** or **Wipe Data** on the AVD, or create a **new AVD** |
| Need a different API level | Create another AVD with the target **API** / **Google Play** image as required by Expo |
| Want a Galaxy-like **appearance** only | Optional: install a **Galaxy Emulator Skin** per Samsung’s docs |

Use a standard **x86_64** Google APIs / Play Store image for fast iteration. For real-device verification, test on a physical phone as part of the strict workflow (USB + optionally Wi‑Fi LAN).

## Physical phone: stuck on blue splash (native splash, app never opens)

The blue screen is the **native** splash (`splash.backgroundColor` in app config). If it never goes away, the device is not loading JavaScript from Metro.

### Emulator console output is not Metro

If the only long-running “terminal” you have shows lines like **`Android emulator version`**, **`netsimd`**, **`VkInstance`**, **`GPU Renderer`**, that window is the **emulator’s own log**, not Metro. Metro appears when you run **`pnpm start`** from **`apps/core/address-maker-glopams`**: you should see **`Metro waiting on …`** / **`Web is waiting on …`** and, when the app loads, bundle activity. If Metro is only a **background** `node` process, open a **new** PowerShell, `cd` to the app folder, run **`pnpm start`** in the **foreground** so you can see errors and confirm it is the right project.

**USB and Wi‑Fi together:** Either can work. With **USB**, prefer **`adb reverse tcp:8081 tcp:8081`** and **`localhost:8081`** in dev settings. With **Wi‑Fi only**, the phone must reach **`http://<laptop-LAN-IP>:8081`** (and Windows Firewall must allow inbound **8081** on Private networks).

### 1. USB: restore port forwarding (`adb reverse`)

On a real device, debug builds often use **`localhost:<port>`** for the bundler, which only works if USB port forwarding is active:

```bash
adb reverse tcp:8081 tcp:8081
```

(Re-run this after reconnecting the cable or when Metro was started in a **different** terminal than `npx expo run:android`.)

**Why:** If Metro is already running in another window, `npx expo run:android` may log that the dev server is already running and then **exit**. When that CLI process ends, Expo can tear down `adb reverse`, so the phone no longer reaches your PC’s Metro on `localhost:8081`.

**Practical workflow:**

- **Option A:** Use **one** terminal: run `npx expo run:android` and let it start Metro (do not start `npx expo start` separately first), **or**
- **Option B:** Keep **`pnpm start`** in one window, then after plugging in USB run **`npm run android:reverse`** or **`pnpm android:reverse`** from `apps/core/address-maker-glopams` (or the `adb reverse` command above), then reload the app (shake → Reload).

If you use a Metro port other than **8081**, run `adb reverse tcp:<port> tcp:<port>` for that port too.

### 2. LAN URL blocked by Windows Firewall

Expo may launch the app with a URL like `http://192.168.x.x:8081`. The phone must reach your PC on that port.

- Allow **inbound** TCP **8081** on **Private** networks for **Node.js** (or temporarily disable the firewall to confirm).
- Phone and PC must be on the **same** Wi‑Fi (no client isolation / guest Wi‑Fi that blocks device-to-device traffic).

### 3. Confirm Metro from the phone’s network

On the phone’s browser, try `http://<your-pc-lan-ip>:8081` (same IP Expo prints). If it does not load, fix network/firewall before debugging the app.

### 4. Wrong dev server host (cached)

Shake the device (or `adb shell input keyevent 82`) → **Open Dev Menu** → **Change bundle location** / debug server → set to `localhost:8081` when using `adb reverse`, or to `YOUR_PC_IP:8081` for Wi‑Fi-only.
