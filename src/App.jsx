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

export default function App() {
  const [activePage, setActivePage] = useState("welcome");
  const state = useRoboFaceSync();
  const Page = pages[activePage] || Welcome;

  return (
    <AppShell
      activePage={activePage}
      onPageChange={setActivePage}
      currentReaction={state.currentReaction}
      activeDevice={state.activeDevice}
      firebaseConnected={state.firebaseConnected}
      realtimeMode={state.realtimeMode}
      theme={state.settings.theme}
    >
      <Page state={state} onNavigate={setActivePage} />
    </AppShell>
  );
}
