import { Check } from "lucide-react";
import { Panel, SelectField, TextField, Toggle } from "../components/Controls.jsx";
import { EmotionEyes } from "../components/EmotionEyes.jsx";
import { DashboardPreview } from "../components/DashboardPreview.jsx";
import { EMOTIONS } from "../data/defaults.js";

const WEATHER_ICONS = [
  { value: "sunny", label: "Sunny" },
  { value: "cloudy", label: "Cloudy" },
  { value: "rain", label: "Rain" },
  { value: "storm", label: "Storm" },
  { value: "night", label: "Night" },
];

export function Emotions({ state }) {
  const { actions } = state;
  const device = state.activeDevice || {};
  const current = device.emotion || "idle";
  const currentMeta = EMOTIONS.find((e) => e.id === current) || EMOTIONS[0];

  return (
    <div className="emotions-page">
      <div className="emotions-left">
        {/* Unified display: eyes (left panel) + dashboard (right panel) */}
        <Panel className="display-panel">
          <div className="canvas-header">
            <div>
              <h2 className="section-title">Live display</h2>
              <p className="microcopy">Eyes + dashboard — exactly what shows on the robot</p>
            </div>
            <div className="live-chip">ON DEVICE</div>
          </div>
          <div className="dual-preview">
            <EmotionEyes emotion={current} className="dual-half" />
            <span className="dual-seam" />
            <DashboardPreview device={device} settings={state.settings} className="dual-half" />
          </div>
        </Panel>

        <Panel title="Emotions">
          <p className="microcopy" style={{ marginBottom: 12 }}>Tap an emotion — it shows on the robot's eyes instantly.</p>
          <div className="emotion-grid">
            {EMOTIONS.map((e) => {
              const active = e.id === current;
              return (
                <button
                  key={e.id}
                  type="button"
                  className={`emotion-card ${active ? "emotion-card-active" : ""}`}
                  onClick={() => actions.setEmotion(e.id)}
                >
                  <span className="emotion-eyes"><EmotionEyes emotion={e.id} className="emotion-thumb" /></span>
                  <span className="emotion-label">{e.label}{active && <Check size={14} strokeWidth={3} />}</span>
                  <small>{e.hint}</small>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title="Dashboard" className="emotions-right">
        <p className="microcopy" style={{ marginBottom: 10 }}>What shows on the right panel. Time/date come from the clock automatically.</p>

        <span className="box-subhead">Weather</span>
        <div className="stack" style={{ marginBottom: 14 }}>
          <SelectField label="Condition" value={device.wxIcon || "sunny"} options={WEATHER_ICONS}
            onChange={(wxIcon) => actions.updateDeviceFields({ wxIcon })} />
          <TextField label="Temperature (°C)" value={device.wxTemp || ""} type="number"
            onChange={(wxTemp) => actions.updateDeviceFields({ wxTemp: String(wxTemp) })} />
          <TextField label="Location" value={device.wxLoc || ""}
            onChange={(wxLoc) => actions.updateDeviceFields({ wxLoc })} placeholder="Colombo" />
        </div>

        <span className="box-subhead">Now playing</span>
        <div className="stack">
          <TextField label="Song title" value={device.musTitle || ""}
            onChange={(musTitle) => actions.updateDeviceFields({ musTitle })} placeholder="Kaavaalaa" />
          <TextField label="Artist" value={device.musArtist || ""}
            onChange={(musArtist) => actions.updateDeviceFields({ musArtist })} placeholder="Aniruth Ravichandar" />
          <Toggle label="Playing" description="Show the now-playing line (scrolls if long)"
            checked={Boolean(device.musPlaying)} onChange={(musPlaying) => actions.updateDeviceFields({ musPlaying })} />
        </div>
      </Panel>
    </div>
  );
}
