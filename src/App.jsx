import { useState } from "react";
import { AppShell } from "./components/AppShell.jsx";
import { useRoboFaceSync } from "./hooks/useRoboFaceSync.js";
import { Welcome } from "./pages/Welcome.jsx";
import { Emotions } from "./pages/Emotions.jsx";
import { SettingsPage } from "./pages/Settings.jsx";
import { EMOTIONS } from "./data/defaults.js";

const pages = {
  welcome: Welcome,
  emotions: Emotions,
  settings: SettingsPage,
};

export default function App() {
  const [activePage, setActivePage] = useState("welcome");
  const state = useRoboFaceSync();
  const Page = pages[activePage] || Welcome;

  // Topbar shows the robot's current emotion (the V2 left-panel state).
  const emo = state.activeDevice?.emotion || "idle";
  const emoMeta = EMOTIONS.find((e) => e.id === emo) || EMOTIONS[0];
  const live = { code: null, name: emoMeta.label, mood: emoMeta.hint, intensity: 100 };

  return (
    <AppShell
      activePage={activePage}
      onPageChange={setActivePage}
      currentReaction={live}
      activeDevice={state.activeDevice}
      firebaseConnected={state.firebaseConnected}
      realtimeMode={state.realtimeMode}
      theme={state.settings.theme}
    >
      <Page state={state} onNavigate={setActivePage} />
    </AppShell>
  );
}
