import { useEffect, useState } from "react";
import { RobotFaceCanvas } from "./RobotFaceCanvas.jsx";

const QUOTES = [
  "Stay curious.",
  "Beep boop, hello!",
  "Keep building.",
  "One step at a time.",
  "Powered by good vibes.",
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function WidgetSlide({ wid, settings }) {
  const now = useClock();
  const fmt12 = settings.display?.timeFormat === "12h";
  const region = settings.display?.region;
  const tz = region && region !== "auto" ? { timeZone: region } : {};

  if (wid === "time") {
    return (
      <div className="slide-widget">
        <span className="sw-time">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: fmt12, ...tz })}
        </span>
      </div>
    );
  }
  if (wid === "date") {
    return (
      <div className="slide-widget">
        <span className="sw-big">{now.toLocaleDateString([], { day: "2-digit", ...tz })}</span>
        <span className="sw-sub">{now.toLocaleDateString([], { month: "short", weekday: "long", ...tz })}</span>
      </div>
    );
  }
  if (wid === "quote") {
    const q = QUOTES[Math.floor(now.getTime() / 4000) % QUOTES.length];
    return (
      <div className="slide-widget">
        <span className="sw-quote">“{q}”</span>
      </div>
    );
  }
  return (
    <div className="slide-widget">
      <span className="sw-sun" />
      <span className="sw-sub">Weather —</span>
    </div>
  );
}

// Controlled: renders the single slide it's told to show. The cycling lives in
// the sync hook so the topbar and this preview always show the same thing.
export function SlideshowPreview({ slide, reactions, settings }) {
  if (!slide) {
    return <div className="robot-canvas" />;
  }
  if (slide.t === "r") {
    const r = reactions[slide.id];
    return r ? <RobotFaceCanvas reaction={r} settings={settings} /> : <div className="robot-canvas" />;
  }
  return <WidgetSlide wid={slide.key} settings={settings} />;
}
