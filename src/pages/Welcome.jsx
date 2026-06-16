import { ArrowRight, Smile, Sparkles, Wifi, WifiOff } from "lucide-react";
import { Button, Panel } from "../components/Controls.jsx";
import { EmotionEyes } from "../components/EmotionEyes.jsx";
import { EMOTIONS } from "../data/defaults.js";

export function Welcome({ state, onNavigate }) {
  const deviceOnline = Boolean(state.activeDevice?.connected || state.activeDevice?.online);
  const firebaseLive = state.realtimeMode === "firebase" && state.firebaseConnected;
  const emo = state.activeDevice?.emotion || "idle";
  const emoMeta = EMOTIONS.find((e) => e.id === emo) || EMOTIONS[0];

  return (
    <div className="welcome-layout">
      <Panel className="welcome-hero">
        <span className="welcome-kicker">
          <Sparkles size={14} /> Welcome to RoboFace
        </span>
        <h1 className="welcome-title">Bring your robot face to life</h1>
        <p className="welcome-sub">
          Pick an emotion and it shows on the robot's eyes instantly. The dashboard panel
          shows time, date, weather and now-playing — all from one place.
        </p>

        <div className="welcome-actions">
          <Button variant="primary" onClick={() => onNavigate("emotions")}>
            <Smile size={16} /> Choose emotion <ArrowRight size={16} />
          </Button>
          <Button variant="ghost" onClick={() => onNavigate("settings")}>
            Settings
          </Button>
        </div>

        <div className="welcome-status">
          <span className={`status-chip ${deviceOnline ? "chip-good" : ""}`}>
            <span className={`pulse-dot ${deviceOnline ? "bg-emerald-500" : "bg-rose-500"}`} />
            Device {deviceOnline ? "online" : "offline"}
          </span>
          <span className="status-chip">
            {firebaseLive ? <Wifi size={15} className="text-blue-600" /> : <WifiOff size={15} className="text-amber-600" />}
            {firebaseLive ? "Firebase live" : "Local demo"}
          </span>
        </div>
      </Panel>

      <Panel className="welcome-preview">
        <div className="canvas-header">
          <div>
            <h2 className="section-title">{emoMeta.label}</h2>
            <p className="microcopy">On the robot's eyes · {emoMeta.hint}</p>
          </div>
          <div className="live-chip">ON DEVICE</div>
        </div>
        <EmotionEyes emotion={emo} />
      </Panel>
    </div>
  );
}
