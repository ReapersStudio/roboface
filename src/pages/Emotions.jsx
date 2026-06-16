import { Check, CloudSun, Music } from "lucide-react";
import { Panel, TextField } from "../components/Controls.jsx";
import { EmotionEyes } from "../components/EmotionEyes.jsx";
import { DashboardPreview } from "../components/DashboardPreview.jsx";
import { EMOTIONS } from "../data/defaults.js";

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
        <p className="microcopy" style={{ marginBottom: 12 }}>
          The dashboard updates by itself. You only set your city once.
        </p>

        <span className="box-subhead">Weather location</span>
        <div className="stack" style={{ marginBottom: 14 }}>
          <TextField
            label="Your city"
            value={device.wxLoc || ""}
            onChange={(wxLoc) => actions.updateDeviceFields({ wxLoc })}
            placeholder="Colombo"
          />
          <div className="auto-row">
            <CloudSun size={18} />
            <div>
              <strong>{device.wxTemp ? `${device.wxTemp}°C · ${device.wxIcon || "—"}` : "Fetching…"}</strong>
              <small>Live weather, fetched automatically</small>
            </div>
          </div>
        </div>

        <span className="box-subhead">Now playing</span>
        <div className="auto-row">
          <Music size={18} />
          <div>
            <strong>
              {device.musPlaying && device.musTitle
                ? `${device.musTitle}${device.musArtist ? " — " + device.musArtist : ""}`
                : "Nothing playing"}
            </strong>
            <small>Comes from your music app automatically</small>
          </div>
        </div>
      </Panel>
    </div>
  );
}
