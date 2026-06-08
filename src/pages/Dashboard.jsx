import { Database, Plus, RefreshCw, Send, Signal } from "lucide-react";
import { Button, Panel, Toggle } from "../components/Controls.jsx";
import { ReactionRail } from "../components/ReactionRail.jsx";
import { RobotFaceCanvas } from "../components/RobotFaceCanvas.jsx";
import { StatusPanel } from "../components/StatusPanel.jsx";
import { reactionToDeviceFields } from "../data/defaults.js";

const formatTime = (value) => {
  if (!value) {
    return "No sync yet";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

function Metric({ label, value, tone = "cyan" }) {
  const toneClass =
    tone === "green" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-blue-600";

  return (
    <div className="metric-tile">
      <span className="status-label">{label}</span>
      <strong className={toneClass}>{value}</strong>
    </div>
  );
}

export function Dashboard({ state }) {
  const { actions } = state;
  const activeDevice = state.activeDevice;
  const deviceOnline = Boolean(activeDevice.connected || activeDevice.online);
  const esp32Fields = reactionToDeviceFields(state.currentReaction);
  const lastSync = state.control.updatedAt || activeDevice.updatedAt || activeDevice.lastSeen;

  return (
    <div className="dashboard-grid">
      <Panel className="preview-panel">
        <div className="canvas-header">
          <div>
            <h2 className="section-title">Live Preview Canvas</h2>
            <p className="microcopy">Simulator mirrors the active Firebase payload for ESP32 displays</p>
          </div>
          <div className="live-chip">LIVE</div>
        </div>
        <RobotFaceCanvas reaction={state.currentReaction} settings={state.settings} />
      </Panel>

      <div className="side-stack">
        <Panel title="Realtime Status">
          <div className="metric-grid">
            <Metric label="Device" value={deviceOnline ? "Online" : "Offline"} tone={deviceOnline ? "green" : "amber"} />
            <Metric label="Reaction" value={state.currentReaction.reaction} />
            <Metric
              label="Firebase"
              value={state.realtimeMode === "firebase" && state.firebaseConnected ? "Connected" : state.realtimeMode}
              tone={state.firebaseConnected ? "green" : "amber"}
            />
            <Metric label="Last Sync" value={formatTime(lastSync)} />
          </div>
        </Panel>

        <StatusPanel
          device={activeDevice}
          firebaseConnected={state.firebaseConnected}
          realtimeMode={state.realtimeMode}
          rootPath={state.rootPath}
        />

        <Panel title="Cycle Control">
          <div className="stack">
            <Toggle
              label="Auto cycle"
              description={`${state.settings.autoCycleInterval} ms interval`}
              checked={state.control.autoCycle}
              onChange={actions.toggleAutoCycle}
            />
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={actions.addReaction}>
                <Plus size={16} />
                Custom
              </Button>
              <Button variant="ghost" onClick={actions.resetReactions}>
                <RefreshCw size={16} />
                Reset
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        className="wide-panel"
        title="ESP32 Field Bus"
        action={
          <Button variant="secondary" onClick={() => actions.selectReaction(state.currentReaction)}>
            <Send size={16} />
            Sync Now
          </Button>
        }
      >
        <div className="field-bus-grid">
          {Object.entries(esp32Fields).map(([key, value]) => (
            <div className="field-bus-item" key={key}>
              <span>{key}</span>
              <strong>{String(value)}</strong>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="wide-panel" title="Reaction State Bus">
        <ReactionRail
          reactions={state.orderedReactions}
          currentReactionId={state.control.currentReactionId}
          onSelect={actions.selectReaction}
          onReorder={actions.reorderReactions}
        />
      </Panel>

      <Panel title="Database Structure">
        <div className="stack">
          {["faces", "reactions", "devices", "users"].map((path) => (
            <div className="db-path" key={path}>
              <Database size={18} />
              <span>/{state.rootPath}/{path}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Device Signal">
        <div className="signal-stack">
          <Signal size={42} className={deviceOnline ? "text-emerald-600" : "text-amber-600"} />
          <div>
            <h3>{activeDevice.name}</h3>
            <p>{activeDevice.status}</p>
            <span>{activeDevice.rssi ?? "--"} dBm / {activeDevice.firmware || "--"}</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
