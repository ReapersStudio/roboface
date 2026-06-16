import { Check, CloudSun, Music, Plus, X } from "lucide-react";
import { Panel, TextField } from "../components/Controls.jsx";
import { EmotionEyes } from "../components/EmotionEyes.jsx";
import { DashboardPreview } from "../components/DashboardPreview.jsx";
import { EMOTIONS } from "../data/defaults.js";

const EMO_BY_ID = Object.fromEntries(EMOTIONS.map((e) => [e.id, e]));

export function Emotions({ state }) {
  const { actions } = state;
  const device = state.activeDevice || {};
  const current = device.emotion || "idle"; // device reports the one playing now
  const rotation = String(device.emotionList || "")
    .split(",")
    .map((s) => s.trim())
    .filter((id) => EMO_BY_ID[id]);

  const toggle = (id) => {
    const next = rotation.includes(id) ? rotation.filter((x) => x !== id) : [...rotation, id];
    actions.setEmotionRotation(next);
  };
  const removeAt = (i) => actions.setEmotionRotation(rotation.filter((_, idx) => idx !== i));

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

        {/* In rotation — the device cycles through these (add/remove) */}
        <Panel title={`In rotation (${rotation.length})`}>
          <p className="microcopy" style={{ marginBottom: 12 }}>
            The robot cycles through these. Add from the right; remove with ✕.
          </p>
          <div className="inuse-list">
            {rotation.length === 0 && (
              <p className="empty-note">No emotions yet — add some from "All emotions" →</p>
            )}
            {rotation.map((id, i) => {
              const meta = EMO_BY_ID[id];
              const playing = id === current && rotation.length > 1;
              return (
                <div className={`inuse-row ${playing ? "inuse-row-active" : ""}`} key={`${id}-${i}`}>
                  <span className="order-num">{i + 1}</span>
                  <span className="inuse-main inuse-widget">
                    <span className="emotion-eyes sm"><EmotionEyes emotion={id} className="emotion-thumb" /></span>
                    <span className="inuse-text">
                      <strong>{meta.label}</strong>
                      <small>{playing ? "On device now" : meta.hint}</small>
                    </span>
                  </span>
                  <button className="remove-btn" type="button" onClick={() => removeAt(i)} aria-label="Remove">
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* All emotions — tap to add/remove from the rotation */}
        <Panel title="All emotions">
          <p className="microcopy" style={{ marginBottom: 12 }}>
            Tap to add to the rotation; tap again to remove.
          </p>
          <div className="emotion-grid">
            {EMOTIONS.map((e) => {
              const inRot = rotation.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  className={`emotion-card ${inRot ? "emotion-card-active" : ""}`}
                  onClick={() => toggle(e.id)}
                >
                  <span className="emotion-eyes"><EmotionEyes emotion={e.id} className="emotion-thumb" /></span>
                  <span className="emotion-label">
                    {e.label}
                    {inRot ? <Check size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
                  </span>
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
