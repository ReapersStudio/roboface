# RoboFace Controller

Futuristic React + Tailwind control console for ESP32 robot face displays backed by Firebase Realtime Database.

## Run

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in your Firebase project values to enable realtime sync. Without Firebase config, the app runs in local demo mode using `localStorage`.

## Pages

- Dashboard: active device status, current reaction, Firebase status, last sync, ESP32 field bus, and live canvas preview.
- Face Creator: visual reaction editor for eye size, position, rotation, blink, animation, custom text, and face templates.
- Reactions: add, duplicate, remove, save, search, import, and export reaction templates.
- Devices: add ESP32 devices, edit device IDs, assign reactions, and monitor online/offline state.
- Settings: theme, Firebase config notes, animation speed, default face, overlay, and transition controls.

## Realtime Database structure

The default root is `/roboface`, configurable with `VITE_FIREBASE_ROOT_PATH`.

```text
/roboface/faces
/roboface/reactions
/roboface/devices
/roboface/users
/roboface/settings
/roboface/control
/roboface/controller/web
```

## ESP32 device fields

Each device record under `/roboface/devices/{deviceId}` receives these fields when a reaction is selected or assigned:

```text
reaction
animation
eyeWidth
eyeHeight
leftX
rightX
leftY
rightY
leftAngle
rightAngle
blink
customText
```

The default reaction set matches the pasted Processing sketch states 0-12. `leftX`, `rightX`, `leftY`, and `rightY` are relative to the 800x480 display center, and angles are stored as degrees in the web app. The ESP32 firmware should subscribe to its device path and apply these values to the display. Device firmware can also update the same record with `connected`, `online`, `lastSeen`, `ip`, `rssi`, `firmware`, and `status`.

## Firebase env

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_ROOT_PATH=roboface
```
