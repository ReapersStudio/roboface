import { useEffect, useMemo, useRef, useState } from "react";
import { RobotFaceCanvas } from "./RobotFaceCanvas.jsx";

const WIDGET_LABELS = { time: "Time", date: "Date", weather: "Weather", quote: "Quote" };
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

// Plays the In-use list as a slideshow (faces + full-screen widgets), exactly
// like the device does — so you can see the flow in the app.
export function SlideshowPreview({ items, reactions, settings, intervalMs = 4000, onSlide }) {
  const slides = useMemo(
    () => (items || []).filter((it) => (it.t === "r" ? reactions[it.id] : WIDGET_LABELS[it.key])),
    [items, reactions],
  );
  const [idx, setIdx] = useState(0);
  const onSlideRef = useRef(onSlide);
  onSlideRef.current = onSlide;

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % slides.length), intervalMs);
    return () => window.clearInterval(id);
  }, [slides.length, intervalMs]);

  const safeIdx = slides.length ? idx % slides.length : 0;
  const cur = slides[safeIdx];

  useEffect(() => {
    if (!cur || !onSlideRef.current) return;
    onSlideRef.current(
      cur.t === "r"
        ? { kind: "reaction", label: reactions[cur.id]?.name || "Reaction", index: safeIdx }
        : { kind: "widget", label: `${WIDGET_LABELS[cur.key]} widget`, index: safeIdx },
    );
  }, [cur, safeIdx, reactions]);

  if (!cur) {
    return <div className="robot-canvas" />;
  }
  if (cur.t === "r") {
    return <RobotFaceCanvas reaction={reactions[cur.id]} settings={settings} />;
  }
  return <WidgetSlide wid={cur.key} settings={settings} />;
}
