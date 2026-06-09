import { BadgeCheck, Clock3, Cpu, Download, Globe, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Panel, SelectField } from "../components/Controls.jsx";
import { APP_VERSION, REGION_OPTIONS } from "../data/defaults.js";

function DeviceFirmware({ state }) {
  const { actions } = state;
  const device = state.activeDevice || {};
  const latest = state.firmware?.version || null;
  const running = device.fwVersion || null;
  const status = device.fwStatus || "";
  const progress = Number(device.fwProgress || 0);

  const working = status === "updating" || status === "checking";
  const failed = status === "failed";
  const updateAvailable = Boolean(latest && running && latest !== running);
  const reportedIn = Boolean(running);

  return (
    <Panel title="Device firmware">
      <div className="fw-card">
        <span className="fw-icon"><Cpu size={22} /></span>
        <div className="fw-body">
          <strong>Robot firmware</strong>
          <small>Running {running || "—"} · Latest {latest || "—"}</small>
        </div>
        {!reportedIn && <span className="fw-badge">Offline</span>}
        {reportedIn && working && <span className="fw-badge">Working…</span>}
        {reportedIn && !working && updateAvailable && (
          <Button variant="primary" onClick={() => actions.requestDeviceUpdate()}>
            <Download size={15} /> Update to {latest}
          </Button>
        )}
        {reportedIn && !working && !updateAvailable && (
          <span className="fw-badge ok"><BadgeCheck size={14} /> Up to date</span>
        )}
      </div>

      {working && (
        <div className="fw-progress">
          <div className="fw-bar"><span style={{ width: `${progress}%` }} /></div>
          <small>{status === "checking" ? "Checking for updates…" : `Installing… ${progress}%`}</small>
        </div>
      )}
      {failed && (
        <p className="microcopy" style={{ color: "var(--bad)" }}>
          <RefreshCw size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          Last update didn't finish — the device will retry automatically.
        </p>
      )}
      {!reportedIn && (
        <p className="microcopy" style={{ marginTop: 10 }}>
          Waiting for the device to report in — make sure it's powered on and online.
        </p>
      )}
    </Panel>
  );
}

const TIME_FORMAT_OPTIONS = [
  { value: "24h", label: "24-hour (18:30)" },
  { value: "12h", label: "12-hour (6:30 PM)" },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function SettingsPage({ state }) {
  const { actions } = state;
  const display = state.settings.display;
  const now = useClock();

  const tzOptions = display.region && display.region !== "auto" ? { timeZone: display.region } : {};
  const timeText = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: display.timeFormat === "12h",
    ...tzOptions,
  });
  const dateText = now.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...tzOptions,
  });

  return (
    <div className="settings-grid">
      <Panel title="App">
        <div className="update-card">
          <span className="update-icon">
            <BadgeCheck size={26} />
          </span>
          <div>
            <strong>You're up to date</strong>
            <small>Version {APP_VERSION}</small>
          </div>
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Check for updates
          </Button>
        </div>
        <p className="microcopy" style={{ marginTop: 12 }}>
          New reactions and widgets are delivered automatically — no manual update needed.
        </p>
      </Panel>

      <DeviceFirmware state={state} />

      <Panel title="Time & date">
        <div className="stack">
          <div className="clock-preview">
            <Clock3 size={18} />
            <div>
              <strong>{timeText}</strong>
              <small>{dateText}</small>
            </div>
          </div>
          <SelectField
            label="Time format"
            value={display.timeFormat}
            options={TIME_FORMAT_OPTIONS}
            onChange={(timeFormat) => actions.updateDisplay({ timeFormat })}
          />
          <SelectField
            label="Region"
            value={display.region}
            options={REGION_OPTIONS}
            onChange={(region) => actions.updateDisplay({ region })}
          />
          <p className="microcopy">
            <Globe size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Region sets the time zone used for the clock and date widgets on your device.
          </p>
        </div>
      </Panel>
    </div>
  );
}
