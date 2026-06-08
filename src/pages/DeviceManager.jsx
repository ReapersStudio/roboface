import { HardDrive, Plus, RadioTower, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Panel, SelectField, TextField } from "../components/Controls.jsx";
import { RobotFaceCanvas } from "../components/RobotFaceCanvas.jsx";

function DeviceCard({ device, active, onSelect, onRemove }) {
  const isOnline = Boolean(device.connected || device.online);

  return (
    <article className={`device-card ${active ? "device-card-active" : ""}`}>
      <button type="button" onClick={onSelect}>
        <span className={`pulse-dot ${isOnline ? "bg-emerald-500" : "bg-rose-500"}`} />
        <span>
          <strong>{device.name}</strong>
          <small>{device.deviceId || device.id}</small>
        </span>
      </button>
      <span className={isOnline ? "text-emerald-600" : "text-rose-600"}>{isOnline ? "Online" : "Offline"}</span>
      <button className="reaction-delete" type="button" aria-label={`Remove ${device.name}`} onClick={onRemove}>
        <Trash2 size={15} />
      </button>
    </article>
  );
}

export function DeviceManager({ state }) {
  const { actions } = state;
  const [newDeviceName, setNewDeviceName] = useState("ESP32 Face");
  const activeDevice = state.activeDevice;
  const assignedReaction = state.reactions[activeDevice.assignedReactionId] || state.currentReaction;
  const reactionOptions = state.orderedReactions.map((reaction) => ({
    value: reaction.id,
    label: `${reaction.code} / ${reaction.name}`,
  }));

  return (
    <div className="device-layout">
      <Panel
        title="Device Registry"
        action={
          <Button variant="secondary" onClick={() => actions.addDevice(newDeviceName)}>
            <Plus size={16} />
            Add
          </Button>
        }
      >
        <div className="stack">
          <TextField label="New Device Name" value={newDeviceName} onChange={setNewDeviceName} />
          <div className="device-list">
            {state.orderedDevices.map((device) => (
              <DeviceCard
                key={device.id}
                active={device.id === activeDevice.id}
                device={device}
                onSelect={() => actions.selectDevice(device.id)}
                onRemove={() => actions.removeDevice(device.id)}
              />
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="device-detail" title="Device ID Management">
        <div className="device-detail-grid">
          <div className="stack">
            <TextField
              label="Device Name"
              value={activeDevice.name}
              onChange={(name) => actions.updateDevice(activeDevice.id, { name })}
            />
            <TextField
              label="Device ID"
              value={activeDevice.deviceId || activeDevice.id}
              onChange={(deviceId) => actions.updateDevice(activeDevice.id, { deviceId })}
            />
            <SelectField
              label="Assigned Reaction"
              value={activeDevice.assignedReactionId || state.currentReaction.id}
              options={reactionOptions}
              onChange={(reactionId) => actions.assignReactionToDevice(activeDevice.id, reactionId)}
            />
            <Button variant="primary" onClick={() => actions.assignReactionToDevice(activeDevice.id, activeDevice.assignedReactionId || state.currentReaction.id)}>
              <Save size={16} />
              Push Assignment
            </Button>
          </div>

          <div className="device-health">
            <RadioTower size={38} />
            <div>
              <span className="status-label">Connection</span>
              <strong>{activeDevice.connected || activeDevice.online ? "Online" : "Offline"}</strong>
            </div>
            <div>
              <span className="status-label">IP / RSSI</span>
              <strong>{activeDevice.ip || "--"} / {activeDevice.rssi ?? "--"} dBm</strong>
            </div>
            <div>
              <span className="status-label">Firmware</span>
              <strong>{activeDevice.firmware || "--"}</strong>
            </div>
            <div>
              <span className="status-label">Status</span>
              <strong>{activeDevice.status || "No heartbeat"}</strong>
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="wide-panel" title="Assigned Face Preview">
        <div className="assigned-preview">
          <RobotFaceCanvas reaction={assignedReaction} settings={state.settings} />
          <div className="field-bus-grid">
            {["reaction", "animation", "eyeWidth", "eyeHeight", "leftX", "rightX", "leftY", "rightY", "leftAngle", "rightAngle", "blink", "customText"].map((field) => (
              <div className="field-bus-item" key={field}>
                <span>{field}</span>
                <strong>{String(activeDevice[field] ?? assignedReaction[field] ?? "--")}</strong>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="wide-panel" title="Realtime Device Paths">
        <div className="device-path-grid">
          {state.orderedDevices.map((device) => (
            <div className="db-path" key={device.id}>
              <HardDrive size={18} />
              <span>/{state.rootPath}/devices/{device.id}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
