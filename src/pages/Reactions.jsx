import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  CloudSun,
  Plus,
  Quote,
  Send,
  X,
} from "lucide-react";
import { useState } from "react";
import { Panel, TextField, Toggle } from "../components/Controls.jsx";
import { RobotFaceCanvas } from "../components/RobotFaceCanvas.jsx";
import { SlideshowPreview } from "../components/SlideshowPreview.jsx";

const WIDGETS = [
  { key: "time", label: "Time", description: "Show the current time on the display", Icon: Clock3 },
  { key: "date", label: "Date", description: "Show today's date on the display", Icon: Calendar },
  { key: "weather", label: "Weather", description: "Show local weather for your region", Icon: CloudSun },
  { key: "quote", label: "Quotes", description: "Cycle short quotes on the display", Icon: Quote },
];
const WIDGET_BY_KEY = Object.fromEntries(WIDGETS.map((w) => [w.key, w]));

export function Reactions({ state }) {
  const { actions } = state;
  const display = state.settings.display;
  const [nowPlaying, setNowPlaying] = useState(null);
  // keep only items that still resolve (drops stale reaction ids / unknown widgets)
  const items = (state.selectionItems || []).filter((it) =>
    it.t === "r" ? Boolean(state.reactions[it.id]) : Boolean(WIDGET_BY_KEY[it.key]),
  );

  const reactionIdsInUse = items.filter((it) => it.t === "r").map((it) => it.id);
  const widgetKeysInUse = items.filter((it) => it.t === "w").map((it) => it.key);
  const weatherInUse = widgetKeysInUse.includes("weather");
  const curSlide = Number(state.activeDevice?.curSlide ?? -1); // device's current slide

  const commit = (next) => actions.setSelectionItems(next);

  const move = (index, dir) => {
    const next = [...items];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    commit(next);
  };
  const removeAt = (index) => commit(items.filter((_, i) => i !== index));
  const addReaction = (id) => {
    if (reactionIdsInUse.includes(id)) return;
    commit([...items, { t: "r", id }]);
  };
  const toggleWidget = (key, on) => {
    if (on) {
      if (widgetKeysInUse.includes(key)) return;
      commit([...items, { t: "w", key }]);
    } else {
      commit(items.filter((it) => !(it.t === "w" && it.key === key)));
    }
  };

  return (
    <div className="reactions-pro">
      <div className="reactions-pro-left">
        {/* LIVE PREVIEW — plays the whole flow like the device does */}
        <Panel className="live-box">
          <div className="canvas-header">
            <div>
              <h2 className="section-title">{nowPlaying?.label || "Flow preview"}</h2>
              <p className="microcopy">
                {items.length > 1
                  ? `Playing your sequence · ${items.length} slides`
                  : "Add more items to see the flow"}
              </p>
            </div>
            <div className="live-chip">PLAYING</div>
          </div>
          <SlideshowPreview
            items={items}
            reactions={state.reactions}
            settings={state.settings}
            intervalMs={Number(state.settings.autoCycleInterval || 4000)}
            onSlide={setNowPlaying}
          />
        </Panel>

        {/* BOX 1 — In use (reactions + widgets, one ordered list) */}
        <Panel title="In use">
          <p className="microcopy" style={{ marginBottom: 12 }}>
            Everything active, in order. Move items up/down or remove what you don't need.
          </p>
          <div className="inuse-list">
            {items.length === 0 && <p className="empty-note">Nothing selected. Add reactions or widgets →</p>}
            {items.map((item, index) => {
              const isReaction = item.t === "r";
              const reaction = isReaction ? state.reactions[item.id] : null;
              const widget = !isReaction ? WIDGET_BY_KEY[item.key] : null;
              if (isReaction && !reaction) return null;
              if (!isReaction && !widget) return null;
              const active = index === curSlide; // device is currently on this slide
              const Icon = widget?.Icon;

              return (
                <div className={`inuse-row ${active ? "inuse-row-active" : ""}`} key={isReaction ? `r-${item.id}` : `w-${item.key}`}>
                  <span className="order-num">{index + 1}</span>
                  {isReaction ? (
                    <button className="inuse-main" type="button" onClick={() => actions.requestJump(index)}>
                      <span className="reaction-code">{reaction.code}</span>
                      <span className="inuse-text">
                        <strong>{reaction.name}</strong>
                        <small>{active ? "On device" : reaction.mood}</small>
                      </span>
                    </button>
                  ) : (
                    <button className="inuse-main inuse-widget" type="button" onClick={() => actions.requestJump(index)}>
                      <span className="widget-icon sm"><Icon size={15} /></span>
                      <span className="inuse-text">
                        <strong>{widget.label}</strong>
                        <small>{active ? "On device" : "widget"}</small>
                      </span>
                    </button>
                  )}
                  <span className="ord-stack">
                    <button className="ord-btn" type="button" onClick={() => move(index, -1)} aria-label="Move up" disabled={index === 0}>
                      <ChevronUp size={14} />
                    </button>
                    <button className="ord-btn" type="button" onClick={() => move(index, 1)} aria-label="Move down" disabled={index === items.length - 1}>
                      <ChevronDown size={14} />
                    </button>
                  </span>
                  <button className="remove-btn" type="button" onClick={() => removeAt(index)} aria-label="Remove">
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="reactions-pro-right">
        {/* BOX 2 — Reaction gallery (animated) */}
        <Panel title="Reaction gallery">
          <p className="microcopy" style={{ marginBottom: 12 }}>
            Preview every reaction and add the ones you want to your set.
          </p>
          <div className="gallery-grid">
            {state.orderedReactions.map((reaction) => {
              const added = reactionIdsInUse.includes(reaction.id);
              return (
                <div className="gallery-card" key={reaction.id}>
                  <div className="gallery-canvas">
                    <RobotFaceCanvas reaction={reaction} settings={state.settings} />
                  </div>
                  <div className="gallery-meta">
                    <span className="reaction-code">{reaction.code}</span>
                    <span className="gallery-name">{reaction.name}</span>
                  </div>
                  <div className="gallery-actions">
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => {
                        const idx = items.findIndex((it) => it.t === "r" && it.id === reaction.id);
                        if (idx >= 0) actions.requestJump(idx);
                        else addReaction(reaction.id);
                      }}
                    >
                      <Send size={14} /> Use
                    </button>
                    <button
                      className={`btn ${added ? "btn-ghost" : "btn-primary"}`}
                      type="button"
                      onClick={() => addReaction(reaction.id)}
                      disabled={added}
                    >
                      {added ? <><Check size={14} /> Added</> : <><Plus size={14} /> Add</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* BOX 3 — Widgets */}
        <Panel title="Widgets">
          <p className="microcopy" style={{ marginBottom: 12 }}>
            Turn a widget on to add it to your list — it lands at the end, and you can reorder it in "In use".
          </p>
          <div className="stack">
            {WIDGETS.map(({ key, label, description, Icon }) => (
              <div className="widget-row" key={key}>
                <span className="widget-icon"><Icon size={18} /></span>
                <Toggle
                  label={label}
                  description={description}
                  checked={widgetKeysInUse.includes(key)}
                  onChange={(on) => toggleWidget(key, on)}
                />
              </div>
            ))}

            {weatherInUse && (
              <TextField
                label="Weather location"
                value={display.weatherLocation}
                onChange={(weatherLocation) => actions.updateDisplay({ weatherLocation })}
                placeholder="City, e.g. Chennai"
              />
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
