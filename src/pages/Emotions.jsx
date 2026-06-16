import { Check } from "lucide-react";
import { Panel } from "../components/Controls.jsx";
import { EmotionEyes } from "../components/EmotionEyes.jsx";
import { EMOTIONS } from "../data/defaults.js";

export function Emotions({ state }) {
  const { actions } = state;
  const current = state.activeDevice?.emotion || "idle";
  const currentMeta = EMOTIONS.find((e) => e.id === current) || EMOTIONS[0];

  return (
    <div className="emotions-page">
      <Panel className="emotions-preview">
        <div className="canvas-header">
          <div>
            <h2 className="section-title">{currentMeta.label}</h2>
            <p className="microcopy">On the robot's eyes · {currentMeta.hint}</p>
          </div>
          <div className="live-chip">ON DEVICE</div>
        </div>
        <EmotionEyes emotion={current} />
      </Panel>

      <Panel title="Emotions" className="emotions-pick">
        <p className="microcopy" style={{ marginBottom: 12 }}>
          Tap an emotion — it shows on the robot's eyes instantly.
        </p>
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
                <span className="emotion-eyes">
                  <EmotionEyes emotion={e.id} className="emotion-thumb" />
                </span>
                <span className="emotion-label">
                  {e.label}
                  {active && <Check size={14} strokeWidth={3} />}
                </span>
                <small>{e.hint}</small>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
