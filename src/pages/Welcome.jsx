import { ArrowRight, Smile, Sparkles, Wifi, WifiOff } from "lucide-react";
import { Button, Panel } from "../components/Controls.jsx";
import { SlideshowPreview } from "../components/SlideshowPreview.jsx";

const WIDGET_NAMES = { time: "Time", date: "Date", weather: "Weather", quote: "Quote" };

export function Welcome({ state, onNavigate }) {
  const deviceOnline = Boolean(state.activeDevice?.connected || state.activeDevice?.online);
  const firebaseLive = state.realtimeMode === "firebase" && state.firebaseConnected;
  const preview = state.preview || {};
  const playingLabel = preview.reaction
    ? preview.reaction.name
    : preview.item?.t === "w"
      ? `${WIDGET_NAMES[preview.item.key] || "Widget"} widget`
      : state.currentReaction.name;

  return (
    <div className="welcome-layout">
      <Panel className="welcome-hero">
        <span className="welcome-kicker">
          <Sparkles size={14} /> Welcome to RoboFace
        </span>
        <h1 className="welcome-title">Bring your robot face to life</h1>
        <p className="welcome-sub">
          Pick a reaction and it shows on your ESP32 display instantly. Add widgets like time,
          date, weather and quotes — all from one place.
        </p>

        <div className="welcome-actions">
          <Button variant="primary" onClick={() => onNavigate("reactions")}>
            <Smile size={16} /> Browse reactions <ArrowRight size={16} />
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
            <h2 className="section-title">Flow preview</h2>
            <p className="microcopy">
              {preview.synced ? "In sync with device · " : ""}Now playing: {playingLabel}
            </p>
          </div>
          <div className="live-chip">{preview.synced ? "SYNCED" : "PLAYING"}</div>
        </div>
        <SlideshowPreview slide={preview.item} reactions={state.reactions} settings={state.settings} />
      </Panel>
    </div>
  );
}
