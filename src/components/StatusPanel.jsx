import { Cpu, Database, RadioTower, Router, Signal } from "lucide-react";
import { Panel } from "./Controls.jsx";

const formatLastSeen = (value) => {
  if (!value) {
    return "No heartbeat";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
};

export function StatusPanel({ device, firebaseConnected, realtimeMode, rootPath }) {
  const esp32 = device || {};
  const isOnline = Boolean(esp32.connected || esp32.online);

  return (
    <Panel title="Connection State">
      <div className="connection-matrix">
        <div className="connection-tile">
          <RadioTower size={18} />
          <span className="status-label">ESP32</span>
          <strong className={isOnline ? "text-emerald-600" : "text-rose-600"}>
            {isOnline ? "Connected" : "Disconnected"}
          </strong>
        </div>
        <div className="connection-tile">
          <Database size={18} />
          <span className="status-label">Firebase</span>
          <strong className={firebaseConnected ? "text-blue-600" : "text-amber-600"}>
            {realtimeMode === "firebase" && firebaseConnected ? "Live" : realtimeMode}
          </strong>
        </div>
        <div className="connection-tile">
          <Router size={18} />
          <span className="status-label">IP</span>
          <strong>{esp32.ip || "--"}</strong>
        </div>
        <div className="connection-tile">
          <Signal size={18} />
          <span className="status-label">RSSI</span>
          <strong>{esp32.rssi ?? "--"} dBm</strong>
        </div>
      </div>
      <div className="mt-4 space-y-2 text-sm text-slate-600">
        <p className="flex items-center justify-between gap-3">
          <span>Heartbeat</span>
          <span className="text-right font-semibold text-slate-800">{formatLastSeen(esp32.lastSeen)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span>Firmware</span>
          <span className="text-right font-semibold text-slate-800">{esp32.firmware || "--"}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span>DB path</span>
          <span className="text-right font-mono text-xs text-slate-800">/{rootPath}/devices/{esp32.id || esp32.deviceId}</span>
        </p>
        <p className="flex items-center gap-2 pt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
          <Cpu size={14} />
          <span>{esp32.status}</span>
        </p>
      </div>
    </Panel>
  );
}
