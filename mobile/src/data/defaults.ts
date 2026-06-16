export const REACTION_SCHEMA_VERSION = "processing-showcase-v1";

export const PAGES = [
  { id: "welcome", label: "Welcome" },
  { id: "reactions", label: "Reactions" },
  { id: "settings", label: "Settings" },
];

export const APP_VERSION = "1.0.0";

export const REGION_OPTIONS = [
  { value: "auto", label: "Auto (device)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Dubai", label: "UAE (GST)" },
  { value: "Europe/London", label: "UK (GMT/BST)" },
  { value: "America/New_York", label: "US East (ET)" },
  { value: "America/Los_Angeles", label: "US West (PT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Australia (AET)" },
];

export const QUOTES = [
  "Stay curious.",
  "Beep boop, hello!",
  "Keep building.",
  "One step at a time.",
  "Powered by good vibes.",
];

export const ANIMATION_OPTIONS = [
  { value: "idle", label: "Idle Breathing" },
  { value: "look-right", label: "Look Right" },
  { value: "look-left", label: "Look Left" },
  { value: "nervous", label: "Nervous Shake" },
  { value: "joy", label: "Joy Bounce" },
  { value: "idea", label: "Idea Float" },
  { value: "side-eye", label: "Side Eye Pan" },
  { value: "walking", label: "Happy Walking" },
  { value: "dance", label: "Dancing" },
  { value: "sleep", label: "Sleep Zzz" },
  { value: "still", label: "Still" },
];

export const THEME_OPTIONS = [
  { value: "cyber", label: "Cyber Cyan" },
  { value: "matrix", label: "Matrix Green" },
  { value: "ember", label: "Ember Alert" },
];

const cyan = "#00ffff";

export const DEFAULT_REACTIONS = [
  {
    id: "normal",
    code: 0,
    name: "Normal",
    reaction: "normal",
    mood: "idle",
    eye: "rect",
    mouth: "none",
    color: cyan,
    intensity: 100,
    animation: "idle",
    feature: "normal",
    eyeWidth: 130,
    eyeHeight: 120,
    leftX: -80,
    rightX: 80,
    leftY: 0,
    rightY: 0,
    leftAngle: 0,
    rightAngle: 0,
    blink: true,
    customText: "",
    order: 0,
    builtin: true,
  },
  {
    id: "look-right",
    code: 1,
    name: "Look Right",
    reaction: "lookRight",
    mood: "tracking",
    eye: "rect",
    mouth: "none",
    color: cyan,
    intensity: 100,
    animation: "look-right",
    feature: "normal",
    eyeWidth: 110,
    eyeHeight: 120,
    leftX: -30,
    rightX: 130,
    leftY: 0,
    rightY: 0,
    leftAngle: 0,
    rightAngle: 0,
    blink: true,
    customText: "",
    order: 1,
    builtin: true,
  },
  {
    id: "look-left",
    code: 2,
    name: "Look Left",
    reaction: "lookLeft",
    mood: "tracking",
    eye: "rect",
    mouth: "none",
    color: cyan,
    intensity: 100,
    animation: "look-left",
    feature: "normal",
    eyeWidth: 110,
    eyeHeight: 120,
    leftX: -130,
    rightX: 30,
    leftY: 0,
    rightY: 0,
    leftAngle: 0,
    rightAngle: 0,
    blink: true,
    customText: "",
    order: 2,
    builtin: true,
  },
  {
    id: "nervous",
    code: 3,
    name: "Nervous",
    reaction: "nervous",
    mood: "shake",
    eye: "rect",
    mouth: "none",
    color: cyan,
    intensity: 100,
    animation: "nervous",
    feature: "sweat",
    eyeWidth: 100,
    eyeHeight: 90,
    leftX: -80,
    rightX: 80,
    leftY: 0,
    rightY: 0,
    leftAngle: 0,
    rightAngle: 0,
    blink: true,
    customText: "",
    order: 3,
    builtin: true,
  },
  {
    id: "sad",
    code: 4,
    name: "Sad",
    reaction: "sad",
    mood: "droop",
    eye: "rect",
    mouth: "none",
    color: cyan,
    intensity: 100,
    animation: "still",
    feature: "normal",
    eyeWidth: 130,
    eyeHeight: 60,
    leftX: -80,
    rightX: 80,
    leftY: 30,
    rightY: 30,
    leftAngle: -11.46,
    rightAngle: 11.46,
    blink: true,
    customText: "",
    order: 4,
    builtin: true,
  },
  {
    id: "angry",
    code: 5,
    name: "Angry",
    reaction: "angry",
    mood: "heated",
    eye: "rect",
    mouth: "none",
    color: cyan,
    intensity: 100,
    animation: "still",
    feature: "vein",
    eyeWidth: 130,
    eyeHeight: 60,
    leftX: -80,
    rightX: 80,
    leftY: 15,
    rightY: 15,
    leftAngle: 20.05,
    rightAngle: -20.05,
    blink: true,
    customText: "",
    order: 5,
    builtin: true,
  },
  {
    id: "joyful",
    code: 6,
    name: "Joyful",
    reaction: "joyful",
    mood: "bounce",
    eye: "curve",
    mouth: "none",
    color: cyan,
    intensity: 100,
    animation: "joy",
    feature: "curve",
    eyeWidth: 130,
    eyeHeight: 10,
    leftX: -80,
    rightX: 80,
    leftY: 10,
    rightY: 10,
    leftAngle: 0,
    rightAngle: 0,
    blink: false,
    customText: "",
    order: 6,
    builtin: true,
  },
  {
    id: "sleep",
    code: 7,
    name: "Sleep",
    reaction: "sleep",
    mood: "sleep",
    eye: "closed",
    mouth: "none",
    color: cyan,
    intensity: 100,
    animation: "sleep",
    feature: "zzz",
    eyeWidth: 130,
    eyeHeight: 20,
    leftX: -80,
    rightX: 80,
    leftY: 45,
    rightY: 45,
    leftAngle: 0,
    rightAngle: 0,
    blink: false,
    customText: "",
    order: 7,
    builtin: true,
  },
  {
    id: "idea",
    code: 8,
    name: "Idea",
    reaction: "idea",
    mood: "bulb",
    eye: "bulb",
    mouth: "none",
    color: "#ffff00",
    intensity: 100,
    animation: "idea",
    feature: "bulb",
    eyeWidth: 130,
    eyeHeight: 10,
    leftX: -80,
    rightX: 80,
    leftY: -30,
    rightY: -30,
    leftAngle: 0,
    rightAngle: 0,
    blink: false,
    customText: "",
    order: 8,
    builtin: true,
  },
  {
    id: "side-eye",
    code: 9,
    name: "Side Eye",
    reaction: "sideEye",
    mood: "suspicious",
    eye: "rect",
    mouth: "none",
    color: cyan,
    intensity: 100,
    animation: "side-eye",
    feature: "normal",
    eyeWidth: 110,
    eyeHeight: 110,
    leftX: -140,
    rightX: 20,
    leftY: 50,
    rightY: 50,
    leftAngle: 0,
    rightAngle: 0,
    blink: true,
    customText: "",
    order: 9,
    builtin: true,
  },
  {
    id: "surprised",
    code: 10,
    name: "Surprised",
    reaction: "surprised",
    mood: "surprised",
    eye: "rect",
    mouth: "none",
    color: cyan,
    intensity: 100,
    animation: "still",
    feature: "normal",
    eyeWidth: 110,
    eyeHeight: 110,
    leftX: -80,
    rightX: 80,
    leftY: -50,
    rightY: -50,
    leftAngle: 0,
    rightAngle: 0,
    blink: true,
    customText: "",
    order: 10,
    builtin: true,
  },
  {
    id: "happy-walking",
    code: 11,
    name: "Happy Walking",
    reaction: "happyWalking",
    mood: "walking",
    eye: "rect",
    mouth: "none",
    color: cyan,
    intensity: 100,
    animation: "walking",
    feature: "normal",
    eyeWidth: 130,
    eyeHeight: 120,
    leftX: -80,
    rightX: 80,
    leftY: -30,
    rightY: -30,
    leftAngle: -5.73,
    rightAngle: -5.73,
    blink: true,
    customText: "",
    order: 11,
    builtin: true,
  },
  {
    id: "dancing",
    code: 12,
    name: "Dancing",
    reaction: "dancing",
    mood: "dance",
    eye: "rect",
    mouth: "none",
    color: cyan,
    intensity: 100,
    animation: "dance",
    feature: "normal",
    eyeWidth: 130,
    eyeHeight: 120,
    leftX: -80,
    rightX: 80,
    leftY: 0,
    rightY: 0,
    leftAngle: 0,
    rightAngle: 0,
    blink: true,
    customText: "",
    order: 12,
    builtin: true,
  },
];

export const DEFAULT_REACTION_RECORD: any = DEFAULT_REACTIONS.reduce((record: any, reaction: any) => {
  record[reaction.id] = reaction;
  return record;
}, {});

export const DEFAULT_SETTINGS = {
  theme: "cyber",
  defaultFaceId: "processing-showcase",
  animationSpeed: 1,
  autoCycleInterval: 4000,
  preview: {
    blinking: true,
    breathing: false,
  },
  display: {
    timeFormat: "24h",
    region: "auto",
    weatherLocation: "",
    widgets: {
      time: { enabled: false, order: 1 },
      date: { enabled: false, order: 2 },
      weather: { enabled: false, order: 3 },
      quote: { enabled: false, order: 4 },
    },
  },
  selection: {
    items: DEFAULT_REACTIONS.map((reaction) => ({ t: "r", id: reaction.id })),
  },
  firebase: {
    rootPath: "roboface",
    projectId: "",
    databaseURL: "",
    status: "Configured with EXPO_PUBLIC environment variables",
  },
  overlay: {
    enabled: false,
    showDate: false,
    showTime: false,
    format: "24h",
    position: "top-right",
    color: "#67e8f9",
    size: 16,
    offsetX: 24,
    offsetY: 24,
  },
  transition: {
    duration: 280,
    easing: "ease-out",
    eyeShift: 34,
    mouthMorph: 58,
    glow: 72,
  },
};

export const reactionToDeviceFields = (reaction: any) => ({
  reaction: reaction.reaction || reaction.name || reaction.id,
  code: Number(reaction.code ?? 0),
  feature: reaction.feature || "normal",
  animation: reaction.animation || "still",
  eyeWidth: Number(reaction.eyeWidth ?? 130),
  eyeHeight: Number(reaction.eyeHeight ?? 120),
  leftX: Number(reaction.leftX ?? -80),
  rightX: Number(reaction.rightX ?? 80),
  leftY: Number(reaction.leftY ?? 0),
  rightY: Number(reaction.rightY ?? 0),
  leftAngle: Number(reaction.leftAngle ?? 0),
  rightAngle: Number(reaction.rightAngle ?? 0),
  blink: Boolean(reaction.blink),
  customText: reaction.customText || "",
});

const defaultDeviceFields = reactionToDeviceFields(DEFAULT_REACTIONS[0]);

export const DEFAULT_DEVICES = {
  "esp32-face-01": {
    id: "esp32-face-01",
    name: "ESP32 Face 01",
    deviceId: "esp32-face-01",
    connected: false,
    online: false,
    status: "Waiting for heartbeat",
    lastSeen: null,
    ip: "--",
    rssi: null,
    firmware: "--",
    assignedReactionId: "normal",
    updatedAt: null,
    ...defaultDeviceFields,
  },
};

export const DEFAULT_FACES = {
  "processing-showcase": {
    id: "processing-showcase",
    name: "Processing Showcase Reactions",
    description: "Exact 0-12 reaction set from the pasted Processing sketch",
    reactionIds: DEFAULT_REACTIONS.map((reaction) => reaction.id),
    createdAt: 0,
    updatedAt: 0,
  },
};

export const DEFAULT_USERS = {
  "mobile-operator": {
    id: "mobile-operator",
    name: "Mobile Operator",
    role: "admin",
    defaultDeviceId: "esp32-face-01",
  },
};

export const DEFAULT_CONTROL = {
  currentDeviceId: "esp32-face-01",
  currentReactionId: "normal",
  currentReactionCode: 0,
  autoCycle: false,
  updatedAt: null,
  source: "mobile",
};

export const DEFAULT_STATE = {
  schemaVersion: REACTION_SCHEMA_VERSION,
  faces: DEFAULT_FACES,
  reactions: DEFAULT_REACTION_RECORD,
  devices: DEFAULT_DEVICES,
  users: DEFAULT_USERS,
  control: DEFAULT_CONTROL,
  settings: DEFAULT_SETTINGS,
};

export const blankReaction = (nextCode: number, order: number) => ({
  id: `custom-${Date.now()}`,
  code: nextCode,
  name: "Custom Reaction",
  reaction: `custom_${nextCode}`,
  mood: "custom",
  eye: "rect",
  mouth: "none",
  color: cyan,
  intensity: 100,
  animation: "still",
  feature: "normal",
  eyeWidth: 130,
  eyeHeight: 120,
  leftX: -80,
  rightX: 80,
  leftY: 0,
  rightY: 0,
  leftAngle: 0,
  rightAngle: 0,
  blink: true,
  customText: "",
  order,
  builtin: false,
});

export const toOrderedReactions = (record: any) =>
  Object.values(record || {}).sort((a: any, b: any) => {
    if ((a.order ?? 0) === (b.order ?? 0)) {
      return (a.code ?? 0) - (b.code ?? 0);
    }
    return (a.order ?? 0) - (b.order ?? 0);
  });

export const toOrderedDevices = (record: any) =>
  Object.values(record || {}).sort((a: any, b: any) => String(a?.name || a?.id || '').localeCompare(String(b?.name || b?.id || '')));

export const toOrderedFaces = (record: any) =>
  Object.values(record || {}).sort((a: any, b: any) => String(a?.name || a?.id || '').localeCompare(String(b?.name || b?.id || '')));

const deepMerge = (base: any, incoming: any): any => {
  if (!incoming || typeof incoming !== "object") {
    return base;
  }

  return Object.entries(incoming).reduce(
    (next: any, [key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        next[key] = deepMerge(base?.[key] || {}, value);
      } else {
        next[key] = value;
      }
      return next;
    },
    { ...base },
  );
};

const normalizeReaction = (reaction: any, fallback: any = DEFAULT_REACTIONS[0]) => {
  const isBuiltin = Boolean(fallback.builtin && reaction.builtin !== false);
  const merged = isBuiltin
    ? { ...reaction, ...fallback, order: reaction.order ?? fallback.order }
    : { ...fallback, ...reaction };

  return {
    ...merged,
    reaction: merged.reaction || merged.id || fallback.reaction,
    animation: merged.animation || fallback.animation || "still",
    eyeWidth: Number(merged.eyeWidth ?? fallback.eyeWidth ?? 130),
    eyeHeight: Number(merged.eyeHeight ?? fallback.eyeHeight ?? 120),
    leftX: Number(merged.leftX ?? fallback.leftX ?? -80),
    rightX: Number(merged.rightX ?? fallback.rightX ?? 80),
    leftY: Number(merged.leftY ?? fallback.leftY ?? 0),
    rightY: Number(merged.rightY ?? fallback.rightY ?? 0),
    leftAngle: Number(merged.leftAngle ?? fallback.leftAngle ?? 0),
    rightAngle: Number(merged.rightAngle ?? fallback.rightAngle ?? 0),
    blink: Boolean(merged.blink ?? fallback.blink ?? true),
    customText: merged.customText ?? fallback.customText ?? "",
  };
};

const normalizeReactionRecord = (incoming: any = {}) => {
  const source = incoming && Object.keys(incoming).length ? incoming : DEFAULT_REACTION_RECORD;

  return Object.values(source).reduce((record: any, reaction: any) => {
    const fallback = DEFAULT_REACTION_RECORD[reaction.id] || DEFAULT_REACTIONS[0];
    const normalized = normalizeReaction(reaction, fallback);
    record[normalized.id] = normalized;
    return record;
  }, {});
};

export const normalizeState = (incoming: any = {}) => {
  const reactions = normalizeReactionRecord(incoming.reactions);
  const orderedReactions = toOrderedReactions(reactions);
  const currentFromId = reactions[incoming.control?.currentReactionId];
  const currentFromCode = orderedReactions.find(
    (reaction: any) => reaction.code === incoming.control?.currentReactionCode,
  );
  const currentReaction = currentFromId || currentFromCode || orderedReactions[0] || DEFAULT_REACTIONS[0];

  const devicesSource =
    incoming.devices && Object.keys(incoming.devices).length
      ? incoming.devices
      : incoming.device?.esp32
        ? { "esp32-face-01": { ...DEFAULT_DEVICES["esp32-face-01"], ...incoming.device.esp32 } }
        : DEFAULT_DEVICES;
  const devices = deepMerge(DEFAULT_DEVICES, devicesSource);
  const orderedDevices = toOrderedDevices(devices);
  const activeDevice =
    devices[incoming.control?.currentDeviceId] || orderedDevices[0] || DEFAULT_DEVICES["esp32-face-01"];

  const faces =
    incoming.faces && Object.keys(incoming.faces).length
      ? deepMerge(DEFAULT_FACES, incoming.faces)
      : DEFAULT_FACES;

  return {
    schemaVersion: incoming.schemaVersion || REACTION_SCHEMA_VERSION,
    faces,
    orderedFaces: toOrderedFaces(faces),
    reactions,
    orderedReactions,
    currentReaction,
    devices,
    orderedDevices,
    activeDevice,
    users: deepMerge(DEFAULT_USERS, incoming.users),
    control: {
      ...DEFAULT_CONTROL,
      ...incoming.control,
      currentDeviceId: activeDevice.id,
      currentReactionId: currentReaction.id,
      currentReactionCode: currentReaction.code,
    },
    settings: deepMerge(DEFAULT_SETTINGS, incoming.settings),
  };
};
