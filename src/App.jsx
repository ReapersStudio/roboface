import { useState } from "react";
import { AppShell } from "./components/AppShell.jsx";
import { useRoboFaceSync } from "./hooks/useRoboFaceSync.js";
import { Welcome } from "./pages/Welcome.jsx";
import { Reactions } from "./pages/Reactions.jsx";
import { SettingsPage } from "./pages/Settings.jsx";

const pages = {
  welcome: Welcome,
  reactions: Reactions,
  settings: SettingsPage,
};

const WIDGET_NAMES = { time: "Time", date: "Date", weather: "Weather", quote: "Quote" };

export default function App() {
  const [activePage, setActivePage] = useState("welcome");
  const state = useRoboFaceSync();
  const Page = pages[activePage] || Welcome;

  // What's playing right now (shared cycler) — keeps the topbar in sync with the preview.
  const p = state.preview;
  const live = p?.reaction
    ? p.reaction
    : p?.item?.t === "w"
      ? { code: null, name: `${WIDGET_NAMES[p.item.key] || "Widget"} widget`, mood: "widget", intensity: 100 }
      : state.currentReaction;

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
