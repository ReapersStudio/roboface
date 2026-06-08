# RoboFace ESP32 firmware (NFP1315 / SSD1306 128x64 OLED)

Renders the **exact** robot-face geometry and animations from the web app on a
monochrome 128x64 OLED, driven **live** from Firebase Realtime Database.
Change a reaction in the app → it shows on the OLED within a moment. Add a brand
new reaction in the app → it renders here automatically, **no reflashing**,
because the firmware is parametric (it reads the reaction's numbers, not a
hard-coded animation).

> Monochrome panel: cyan / yellow / red and the glow halo from the app become
> plain **white-on-black**. Shapes, positions, blink and motion match exactly.

## 1. Wiring (NFP1315 is an SSD1306 I2C panel)

| OLED pin | ESP32 |
|----------|-------|
| VCC      | 3V3   |
| GND      | GND   |
| SCL      | GPIO22 |
| SDA      | GPIO21 |

I2C address is usually `0x3C` (a few modules are `0x3D` — change `OLED_ADDR`).

## 2. Libraries (Arduino IDE → Library Manager)

- **Firebase Arduino Client Library for ESP8266 and ESP32** (author *Mobizt*)
- **Adafruit SSD1306** (installs **Adafruit GFX Library** as a dependency)

Board: install the **esp32** boards package and pick your ESP32 board.

## 3. Configure the sketch

Edit the `USER CONFIG` block at the top of `roboface_oled/roboface_oled.ino`:

```cpp
#define WIFI_SSID      "..."
#define WIFI_PASSWORD  "..."
#define API_KEY        "..."   // Firebase: Project settings → Web API Key
#define DATABASE_URL   "https://YOUR-PROJECT-default-rtdb.firebaseio.com"
#define ROOT_PATH      "roboface"        // = VITE_FIREBASE_ROOT_PATH in app .env
#define DEVICE_ID      "esp32-face-01"   // = the id in the app's Devices page
```

`API_KEY` and `DATABASE_URL` must be the **same Firebase project** the web app
writes to. `DEVICE_ID` must match the device you control in the app (default
`esp32-face-01`; create/rename devices on the Devices page).

## 4. Firebase auth + rules

The sketch uses **anonymous sign-in**. In the Firebase console:

1. **Authentication → Sign-in method → Anonymous → Enable.**
2. **Realtime Database → Rules.** For a quick test:

   ```json
   { "rules": { ".read": true, ".write": true } }
   ```

   For something safer while still letting any signed-in client read/write:

   ```json
   { "rules": { ".read": "auth != null", ".write": "auth != null" } }
   ```

## 5. Flash and run

1. Select your ESP32 board + COM port, **Upload**.
2. Open Serial Monitor @ **115200**. You should see WiFi → Firebase sign-in →
   `Streaming /roboface/devices/esp32-face-01`.
3. In the web app, pick a reaction (or toggle Auto cycle). The OLED follows.

## How "add a reaction → it just works" works

The app pushes the selected reaction's fields to
`/roboface/devices/<DEVICE_ID>`:

```
reaction, code, feature, animation,
eyeWidth, eyeHeight, leftX, rightX, leftY, rightY,
leftAngle, rightAngle, blink, customText
```

The ESP32 streams that node and rebuilds the face every frame from those
numbers, applying the same per-`code` motion (breathing, jitter, bounce, float,
pan, walk-bob, dance) and the same `feature` overlays (sweat, vein, curve eyes,
light bulb, Zzz) as `RobotFaceCanvas.jsx`. A new custom reaction is just a new
set of those numbers, so it renders with no firmware change.

> `code` and `feature` were added to the device payload (see
> `reactionToDeviceFields` in `src/data/defaults.js`) so the device can match the
> app's `code`-keyed animations exactly. Rebuild/redeploy the web app once after
> pulling this change so devices start receiving those two fields.

## Widgets (Time / Date / Quote shown on the OLED)

Toggle these in the app's **Reactions → Widgets** panel; each has a **#order**
that sets the stacking order on the display (lower = higher up).

- **Time / Date** — driven by NTP (the device syncs the clock over WiFi). Uses
  your **time format** (24h/12h) and **region** (time zone) from Settings.
- **Quote** — cycles the built-in list every ~4s (mirror of the app's list).
- **Weather** — UI + config land now, but the OLED shows `Weather --` until a
  later firmware build wires the free Open-Meteo API. Set the city in the app.

Widgets render as small lines at the top of the screen, over the eyes, with a
black underlay so they stay readable.

## Wireless firmware updates (OTA via GitHub Releases)

Content (reactions, widget toggles, time format, region) updates live with **no
reflash** — it streams from Firebase. But changes to the *firmware itself* (new
animation logic, widget rendering, bug fixes) need a new build. OTA lets the
ESP32 download and flash that new build over WiFi — **no USB cable**.

### One-time: how it works
- The sketch has `#define FW_VERSION "1.0.0"`.
- On boot and every 5 min, the device reads `/<root>/firmware` from Firebase:

  ```json
  { "firmware": { "version": "1.1.0", "url": "https://github.com/<you>/<repo>/releases/download/v1.1.0/roboface_oled.ino.bin" } }
  ```
- If `version` differs from the running `FW_VERSION`, it downloads the `.bin`
  over HTTPS (follows GitHub's redirect) and self-flashes, then reboots. The
  boot splash shows `v<version>` so you can confirm.

### Publishing an update
1. In the sketch, bump `#define FW_VERSION` to the new number (e.g. `"1.1.0"`).
2. Arduino IDE → **Sketch → Export Compiled Binary**. The `.bin` lands in the
   sketch folder under `build/.../roboface_oled.ino.bin`.
3. On GitHub: **Releases → Draft a new release**, tag it `v1.1.0`, and **attach
   the `.bin`** as a release asset. Publish.
4. Copy the asset's download URL (right-click the `.bin` → copy link). It looks
   like `https://github.com/<you>/<repo>/releases/download/v1.1.0/roboface_oled.ino.bin`.
5. In the Firebase console (Realtime Database), set:
   - `/<root>/firmware/version` = `1.1.0`
   - `/<root>/firmware/url` = the URL from step 4

Within ~5 minutes (or on next boot) every device updates itself. The **first**
flash still has to go over USB once — OTA only works after a build that already
contains this OTA code is on the chip.

> Repo must be **public** for the device to fetch the asset without auth
> (`client.setInsecure()` skips cert checks but not GitHub auth). For a private
> repo, host the `.bin` somewhere public or use Firebase Storage instead.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Blank screen, "SSD1306 not found" | Wrong I2C address — try `0x3D`; check SDA/SCL. |
| Stuck at "connecting..." | WiFi creds; ESP32 needs 2.4 GHz. |
| `sign-in` error in Serial | Enable **Anonymous** auth; check `API_KEY`. |
| Eyes never change | `ROOT_PATH` / `DEVICE_ID` must match the app; confirm the app is in **Firebase** mode (not local-demo) and writing to that device. |
| Motion/feature wrong for a reaction | Redeploy the web app so it pushes `code` + `feature`. |
