import { BadgeCheck, Clock3, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Panel, SelectField } from "../components/Controls.jsx";
import { APP_VERSION, REGION_OPTIONS } from "../data/defaults.js";

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
