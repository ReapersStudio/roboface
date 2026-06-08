import {
  Activity,
  Bot,
  Clock3,
  Home,
  Settings,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { PAGES } from "../data/defaults.js";

const pageIcons = {
  welcome: Home,
  reactions: Smile,
  settings: Settings,
};

export function AppShell({
  activePage,
  onPageChange,
  children,
  currentReaction,
  activeDevice,
  firebaseConnected,
  realtimeMode,
  theme = "cyber",
}) {
  const esp32Connected = Boolean(activeDevice?.connected || activeDevice?.online);
  const FirebaseIcon = firebaseConnected ? Wifi : WifiOff;

  return (
    <div className={`min-h-screen bg-app theme-${theme} text-slate-800`}>
      <header className="appbar">
        <div className="appbar-inner">
          <div className="brand">
            <span className="brand-mark">
              <Bot size={22} />
            </span>
            <span>
              <span className="brand-name">RoboFace</span>
              <span className="brand-subtitle">ESP32 Control</span>
            </span>
          </div>

          <nav className="nav-list" aria-label="Primary navigation">
            {PAGES.map((page) => {
              const Icon = pageIcons[page.id];
              return (
                <button
                  key={page.id}
                  className={`nav-item ${activePage === page.id ? "nav-item-active" : ""}`}
                  aria-label={page.label}
                  onClick={() => onPageChange(page.id)}
                >
                  <Icon size={17} />
                  <span>{page.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="appbar-status">
            <div className="status-chip">
              <span className={`pulse-dot ${esp32Connected ? "bg-emerald-500" : "bg-rose-500"}`} />
              <span className="status-label">ESP32</span>
              <span>{esp32Connected ? "Online" : "Offline"}</span>
            </div>
            <div className="status-chip">
              <FirebaseIcon size={15} className={firebaseConnected ? "text-blue-600" : "text-amber-600"} />
              <span>{realtimeMode === "firebase" ? "Firebase" : "Local demo"}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <header className="topbar">
          <div>
            <p className="topbar-kicker">Current state</p>
            <h1>{currentReaction.code} / {currentReaction.name}</h1>
          </div>
          <div className="topbar-grid">
          <div className="telemetry-pill">
            <Sparkles size={15} />
            <span>{currentReaction.mood}</span>
          </div>
          <div className="telemetry-pill">
            <SlidersHorizontal size={15} />
            <span>{activeDevice?.name || activeDevice?.deviceId || "No device"}</span>
          </div>
          <div className="telemetry-pill">
            <Activity size={15} />
            <span>{currentReaction.intensity}%</span>
            </div>
            <div className="telemetry-pill">
              <Clock3 size={15} />
              <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
