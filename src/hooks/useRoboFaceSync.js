import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_DEVICES,
  DEFAULT_FACES,
  DEFAULT_REACTION_RECORD,
  DEFAULT_SETTINGS,
  DEFAULT_USERS,
  REACTION_SCHEMA_VERSION,
  blankReaction,
  normalizeState,
  reactionToDeviceFields,
  toOrderedReactions,
} from "../data/defaults.js";
import { realtimeStore } from "../services/realtimeStore.js";

const nowStamp = () => Date.now();
const slug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const createDevicePayload = (device, reaction) => ({
  ...device,
  id: device.id || device.deviceId,
  deviceId: device.deviceId || device.id,
  assignedReactionId: reaction.id,
  updatedAt: nowStamp(),
  ...reactionToDeviceFields(reaction),
});

export function useRoboFaceSync() {
  const [rawState, setRawState] = useState(null);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const seededRef = useRef(false);

  useEffect(() => realtimeStore.subscribeData(setRawState), []);
  useEffect(() => realtimeStore.subscribeConnection(setFirebaseConnected), []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      realtimeStore.touchController();
    }, 15000);

    realtimeStore.touchController();
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!rawState || seededRef.current) {
      return;
    }

    seededRef.current = true;

    if (rawState.schemaVersion !== REACTION_SCHEMA_VERSION) {
      realtimeStore.setValue("schemaVersion", REACTION_SCHEMA_VERSION);
      realtimeStore.setValue("reactions", DEFAULT_REACTION_RECORD);
      realtimeStore.setValue("faces", DEFAULT_FACES);
      realtimeStore.updateValue("settings", {
        defaultFaceId: DEFAULT_SETTINGS.defaultFaceId,
        preview: DEFAULT_SETTINGS.preview,
        overlay: DEFAULT_SETTINGS.overlay,
      });
    }

    if (!rawState.faces || !Object.keys(rawState.faces).length) {
      realtimeStore.setValue("faces", DEFAULT_FACES);
    }

    if (!rawState.reactions || !Object.keys(rawState.reactions).length) {
      realtimeStore.setValue("reactions", DEFAULT_REACTION_RECORD);
    }

    if (!rawState.devices || !Object.keys(rawState.devices).length) {
      realtimeStore.setValue("devices", DEFAULT_DEVICES);
    }

    if (!rawState.users || !Object.keys(rawState.users).length) {
      realtimeStore.setValue("users", DEFAULT_USERS);
    }

    if (!rawState.settings) {
      realtimeStore.setValue("settings", DEFAULT_SETTINGS);
    }
  }, [rawState]);

  const state = useMemo(() => normalizeState(rawState || {}), [rawState]);

  const syncReactionToDevice = useCallback(
    (reaction, deviceId = state.control.currentDeviceId, source = "web") => {
      if (!deviceId || !reaction) {
        return;
      }

      realtimeStore.updateValue(`devices/${deviceId}`, {
        assignedReactionId: reaction.id,
        source,
        updatedAt: nowStamp(),
        ...reactionToDeviceFields(reaction),
      });
    },
    [state.control.currentDeviceId],
  );

  const selectionItems = useMemo(() => {
    const raw = state.settings.selection?.items;
    // Firebase may return an array as an index-keyed object — normalize both.
    const items = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object"
        ? Object.values(raw)
        : null;
    if (items) {
      return items.filter((item) => item && (item.t === "r" ? item.id : item.key));
    }
    // migrate from older reactionIds shape if present
    const rawIds = state.settings.selection?.reactionIds;
    const ids = Array.isArray(rawIds)
      ? rawIds
      : rawIds && typeof rawIds === "object"
        ? Object.values(rawIds)
        : null;
    if (ids) {
      return ids.map((id) => ({ t: "r", id }));
    }
    return state.orderedReactions.map((reaction) => ({ t: "r", id: reaction.id }));
  }, [state.settings.selection, state.orderedReactions]);

  const selectedReactions = useMemo(() => {
    const picked = selectionItems
      .filter((item) => item.t === "r")
      .map((item) => state.reactions[item.id])
      .filter(Boolean);
    return picked.length ? picked : state.orderedReactions;
  }, [selectionItems, state.reactions, state.orderedReactions]);

  useEffect(() => {
    if (!state.control.autoCycle || selectedReactions.length < 2) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      const currentIndex = selectedReactions.findIndex(
        (reaction) => reaction.id === state.control.currentReactionId,
      );
      const nextReaction = selectedReactions[(currentIndex + 1) % selectedReactions.length];
      realtimeStore.updateValue("control", {
        currentReactionId: nextReaction.id,
        currentReactionCode: nextReaction.code,
        updatedAt: nowStamp(),
        source: "auto-cycle",
      });
      syncReactionToDevice(nextReaction, state.control.currentDeviceId, "auto-cycle");
    }, state.settings.autoCycleInterval);

    return () => window.clearInterval(interval);
  }, [
    state.control.autoCycle,
    state.control.currentDeviceId,
    state.control.currentReactionId,
    selectedReactions,
    state.settings.autoCycleInterval,
    syncReactionToDevice,
  ]);

  const selectReaction = useCallback(
    (reaction, deviceId = state.control.currentDeviceId) => {
      realtimeStore.updateValue("control", {
        currentDeviceId: deviceId,
        currentReactionId: reaction.id,
        currentReactionCode: reaction.code,
        updatedAt: nowStamp(),
        source: "web",
      });
      syncReactionToDevice(reaction, deviceId);
    },
    [state.control.currentDeviceId, syncReactionToDevice],
  );

  const selectDevice = useCallback(
    (deviceId) => {
      realtimeStore.updateValue("control", {
        currentDeviceId: deviceId,
        updatedAt: nowStamp(),
        source: "web",
      });
      syncReactionToDevice(state.currentReaction, deviceId);
    },
    [state.currentReaction, syncReactionToDevice],
  );

  const toggleAutoCycle = useCallback((enabled) => {
    realtimeStore.updateValue("control", {
      autoCycle: enabled,
      updatedAt: nowStamp(),
      source: "web",
    });
  }, []);

  const upsertReaction = useCallback(
    (reaction) => {
      const normalized = {
        ...reaction,
        reaction: reaction.reaction || slug(reaction.name) || reaction.id,
        updatedAt: nowStamp(),
      };

      realtimeStore.setValue(`reactions/${normalized.id}`, normalized);

      if (state.control.currentReactionId === normalized.id) {
        realtimeStore.updateValue("control", {
          currentReactionId: normalized.id,
          currentReactionCode: normalized.code,
          updatedAt: nowStamp(),
          source: "web",
        });
        syncReactionToDevice(normalized);
      }
    },
    [state.control.currentReactionId, syncReactionToDevice],
  );

  const addReaction = useCallback(() => {
    const ordered = toOrderedReactions(state.reactions);
    const nextCode = Math.max(...ordered.map((reaction) => reaction.code), 12) + 1;
    const reaction = blankReaction(nextCode, ordered.length);
    realtimeStore.setValue(`reactions/${reaction.id}`, reaction);
    realtimeStore.updateValue("control", {
      currentReactionId: reaction.id,
      currentReactionCode: reaction.code,
      updatedAt: nowStamp(),
      source: "web",
    });
    syncReactionToDevice(reaction);
  }, [state.reactions, syncReactionToDevice]);

  const duplicateReaction = useCallback(
    (reactionId) => {
      const source = state.reactions[reactionId];
      if (!source) {
        return;
      }

      const ordered = toOrderedReactions(state.reactions);
      const nextCode = Math.max(...ordered.map((reaction) => reaction.code), 12) + 1;
      const duplicated = {
        ...source,
        id: `${source.id}-copy-${Date.now()}`,
        code: nextCode,
        name: `${source.name} Copy`,
        reaction: `${source.reaction || source.id}_copy`,
        order: ordered.length,
        builtin: false,
        updatedAt: nowStamp(),
      };

      realtimeStore.setValue(`reactions/${duplicated.id}`, duplicated);
      realtimeStore.updateValue("control", {
        currentReactionId: duplicated.id,
        currentReactionCode: duplicated.code,
        updatedAt: nowStamp(),
        source: "web",
      });
      syncReactionToDevice(duplicated);
    },
    [state.reactions, syncReactionToDevice],
  );

  const removeReaction = useCallback(
    (reactionId) => {
      const nextList = state.orderedReactions.filter((reaction) => reaction.id !== reactionId);
      if (!nextList.length) {
        return;
      }

      realtimeStore.removeValue(`reactions/${reactionId}`);

      if (state.control.currentReactionId === reactionId) {
        const fallback = nextList[0];
        realtimeStore.updateValue("control", {
          currentReactionId: fallback.id,
          currentReactionCode: fallback.code,
          updatedAt: nowStamp(),
          source: "web",
        });
        syncReactionToDevice(fallback);
      }
    },
    [state.control.currentReactionId, state.orderedReactions, syncReactionToDevice],
  );

  const reorderReactions = useCallback((orderedReactions) => {
    orderedReactions.forEach((reaction, order) => {
      realtimeStore.updateValue(`reactions/${reaction.id}`, { order });
    });
  }, []);

  const resetReactions = useCallback(() => {
    realtimeStore.setValue("schemaVersion", REACTION_SCHEMA_VERSION);
    realtimeStore.setValue("reactions", DEFAULT_REACTION_RECORD);
    realtimeStore.setValue("faces", DEFAULT_FACES);
    realtimeStore.updateValue("control", {
      currentReactionId: "normal",
      currentReactionCode: 0,
      updatedAt: nowStamp(),
      source: "web",
    });
    syncReactionToDevice(DEFAULT_REACTION_RECORD.normal);
  }, [syncReactionToDevice]);

  const saveFaceTemplate = useCallback(
    (name, reactionIds = state.orderedReactions.map((reaction) => reaction.id)) => {
      const id = slug(name) || `face-${Date.now()}`;
      realtimeStore.setValue(`faces/${id}`, {
        id,
        name: name || "Untitled Face",
        description: `${reactionIds.length} linked reactions`,
        reactionIds,
        createdAt: state.faces[id]?.createdAt || nowStamp(),
        updatedAt: nowStamp(),
      });
      realtimeStore.updateValue("settings", { defaultFaceId: id });
    },
    [state.faces, state.orderedReactions],
  );

  const addDevice = useCallback(
    (name = "New ESP32 Face") => {
      const id = `${slug(name) || "esp32-face"}-${Date.now().toString().slice(-5)}`;
      const payload = createDevicePayload(
        {
          id,
          deviceId: id,
          name,
          connected: false,
          online: false,
          status: "Registered from web console",
          lastSeen: null,
          ip: "--",
          rssi: null,
          firmware: "--",
        },
        state.currentReaction,
      );
      realtimeStore.setValue(`devices/${id}`, payload);
      realtimeStore.updateValue("control", {
        currentDeviceId: id,
        updatedAt: nowStamp(),
        source: "web",
      });
    },
    [state.currentReaction],
  );

  const updateDevice = useCallback((deviceId, patch) => {
    realtimeStore.updateValue(`devices/${deviceId}`, {
      ...patch,
      updatedAt: nowStamp(),
    });
  }, []);

  const removeDevice = useCallback(
    (deviceId) => {
      const nextDevices = state.orderedDevices.filter((device) => device.id !== deviceId);
      if (!nextDevices.length) {
        return;
      }

      realtimeStore.removeValue(`devices/${deviceId}`);
      if (state.control.currentDeviceId === deviceId) {
        realtimeStore.updateValue("control", {
          currentDeviceId: nextDevices[0].id,
          updatedAt: nowStamp(),
          source: "web",
        });
      }
    },
    [state.control.currentDeviceId, state.orderedDevices],
  );

  const assignReactionToDevice = useCallback(
    (deviceId, reactionId) => {
      const reaction = state.reactions[reactionId];
      if (!reaction) {
        return;
      }
      syncReactionToDevice(reaction, deviceId);
    },
    [state.reactions, syncReactionToDevice],
  );

  const importTemplate = useCallback((payload) => {
    if (payload.faces) {
      realtimeStore.updateValue("faces", payload.faces);
    }
    if (payload.reactions) {
      realtimeStore.updateValue("reactions", payload.reactions);
    }
    if (payload.devices) {
      realtimeStore.updateValue("devices", payload.devices);
    }
    if (payload.settings) {
      realtimeStore.updateValue("settings", payload.settings);
    }
  }, []);

  const updateOverlay = useCallback((patch) => {
    realtimeStore.updateValue("settings/overlay", patch);
  }, []);

  const updateTransition = useCallback((patch) => {
    realtimeStore.updateValue("settings/transition", patch);
  }, []);

  const updatePreview = useCallback((patch) => {
    realtimeStore.updateValue("settings/preview", patch);
  }, []);

  const updateDisplay = useCallback(
    (patch) => {
      const current = state.settings.display || {};
      const currentWidgets = current.widgets || {};
      const patchWidgets = patch.widgets || {};
      const nextWidgets = { ...currentWidgets };
      Object.keys(patchWidgets).forEach((key) => {
        nextWidgets[key] = { ...currentWidgets[key], ...patchWidgets[key] };
      });
      const next = { ...current, ...patch, widgets: nextWidgets };
      const w = (key) => nextWidgets[key] || {};

      realtimeStore.updateValue("settings/display", { ...patch, widgets: nextWidgets });
      realtimeStore.updateValue(`devices/${state.control.currentDeviceId}`, {
        widgetTime: Boolean(w("time").enabled),
        widgetTimeOrder: Number(w("time").order ?? 1),
        widgetDate: Boolean(w("date").enabled),
        widgetDateOrder: Number(w("date").order ?? 2),
        widgetWeather: Boolean(w("weather").enabled),
        widgetWeatherOrder: Number(w("weather").order ?? 3),
        widgetQuote: Boolean(w("quote").enabled),
        widgetQuoteOrder: Number(w("quote").order ?? 4),
        timeFormat: next.timeFormat,
        region: next.region,
        weatherLocation: next.weatherLocation,
        updatedAt: nowStamp(),
      });
    },
    [state.settings.display, state.control.currentDeviceId],
  );

  // Single source of truth for the "In use" list (reactions + widgets, ordered).
  // Writing it also derives widget enabled/order and mirrors them to the device.
  const setSelectionItems = useCallback(
    (items) => {
      const clean = (items || []).filter(Boolean);
      realtimeStore.updateValue("settings/selection", { items: clean });

      const widgetKeys = ["time", "date", "weather", "quote"];
      const widgetItems = clean.filter((item) => item.t === "w");
      const widgets = {};
      widgetKeys.forEach((key) => {
        const rank = widgetItems.findIndex((item) => item.key === key);
        widgets[key] = { enabled: rank >= 0, order: rank >= 0 ? rank + 1 : 9 };
      });

      realtimeStore.updateValue("settings/display", { widgets });
      realtimeStore.updateValue(`devices/${state.control.currentDeviceId}`, {
        widgetTime: widgets.time.enabled,
        widgetTimeOrder: widgets.time.order,
        widgetDate: widgets.date.enabled,
        widgetDateOrder: widgets.date.order,
        widgetWeather: widgets.weather.enabled,
        widgetWeatherOrder: widgets.weather.order,
        widgetQuote: widgets.quote.enabled,
        widgetQuoteOrder: widgets.quote.order,
        updatedAt: nowStamp(),
      });

      // if the active reaction was removed, switch to the first remaining one
      const reactionIds = clean.filter((item) => item.t === "r").map((item) => item.id);
      if (!reactionIds.includes(state.control.currentReactionId) && reactionIds.length) {
        const fallback = state.reactions[reactionIds[0]];
        if (fallback) {
          selectReaction(fallback);
        }
      }
    },
    [state.control.currentDeviceId, state.control.currentReactionId, state.reactions, selectReaction],
  );

  const requestDeviceUpdate = useCallback(
    (deviceId = state.control.currentDeviceId) => {
      if (!deviceId) {
        return;
      }
      realtimeStore.updateValue(`devices/${deviceId}`, {
        fwUpdateNow: true,
        updatedAt: nowStamp(),
      });
    },
    [state.control.currentDeviceId],
  );

  const updateSettings = useCallback((patch) => {
    realtimeStore.updateValue("settings", patch);
  }, []);

  const updateFirebaseSettings = useCallback((patch) => {
    realtimeStore.updateValue("settings/firebase", patch);
  }, []);

  return {
    ...state,
    selectionItems,
    firmware: rawState?.firmware || null,
    firebaseConnected,
    realtimeMode: realtimeStore.mode,
    rootPath: realtimeStore.rootPath,
    actions: {
      selectReaction,
      selectDevice,
      toggleAutoCycle,
      upsertReaction,
      addReaction,
      duplicateReaction,
      removeReaction,
      reorderReactions,
      resetReactions,
      saveFaceTemplate,
      addDevice,
      updateDevice,
      removeDevice,
      assignReactionToDevice,
      importTemplate,
      updateOverlay,
      updateTransition,
      updatePreview,
      updateDisplay,
      setSelectionItems,
      requestDeviceUpdate,
      updateSettings,
      updateFirebaseSettings,
    },
  };
}
