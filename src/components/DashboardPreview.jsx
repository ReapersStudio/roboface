import { useEffect, useRef } from "react";

// Live preview of the RIGHT panel — mirrors the firmware carousel:
// shows ONE screen at a time (Time -> Date -> Weather), sliding vertically
// between them. When music is playing it takes over for ~1 min (track + beat
// bars) synced with the dancing eyes, then drops back to Time/Date, looping.
const DWELL = 5000, TRANS = 340, MUSIC_DANCE = 60000, MUSIC_INFO = 15000;
const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MO = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function DashboardPreview({ device = {}, settings = {}, className = "" }) {
  const canvasRef = useRef(null);
  const dataRef = useRef({ device, settings });
  dataRef.current = { device, settings };

  const musRef = useRef({ on: false, start: 0 });
  const trRef = useRef({ cur: "time", prev: "time", start: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf = 0;

    const wxGlyph = (x, y, w) => {
      ctx.strokeStyle = "#22d3ee";
      ctx.fillStyle = "#22d3ee";
      ctx.lineWidth = 1.5;
      const cx = x + 8, cy = y + 8;
      if (w === "sunny" || w === "sun" || w === "clear") {
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
        for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6); ctx.lineTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8); ctx.stroke(); }
      } else if (w === "night" || w === "moon") {
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fill();
        ctx.fillStyle = "#070a12"; ctx.beginPath(); ctx.arc(cx + 3, cy - 2, 6, 0, 7); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(x + 6, y + 7, 4, 0, 7); ctx.arc(x + 11, y + 6, 5, 0, 7); ctx.fill();
        ctx.fillRect(x + 2, y + 7, 14, 5);
        if (w === "rain") for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + 5 + i * 5, y + 13); ctx.lineTo(x + 5 + i * 5, y + 16); ctx.stroke(); }
        if (w === "storm") { ctx.beginPath(); ctx.moveTo(x + 9, y + 12); ctx.lineTo(x + 6, y + 16); ctx.lineTo(x + 10, y + 14); ctx.stroke(); }
      }
    };

    const render = (now) => {
      const { device: d, settings: s } = dataRef.current;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const W = Math.max(160, rect.width), H = Math.max(120, rect.height);
      if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
        canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#070a12"; ctx.fillRect(0, 0, W, H);

      // local time, honoring region + 12/24h
      const fmt12 = s.display?.timeFormat === "12h";
      const region = s.display?.region;
      const tz = region && region !== "auto" ? { timeZone: region } : {};
      const local = new Date(new Date().toLocaleString("en-US", tz));
      const pad = (n) => String(n).padStart(2, "0");

      // --- which screen + transition (mirrors firmware stepScene) ---
      const music = Boolean(d.musPlaying && d.musTitle);
      if (music && !musRef.current.on) musRef.current = { on: true, start: now };
      if (!music) musRef.current.on = false;

      let screen;
      if (music) {
        const ph = (now - musRef.current.start) % (MUSIC_DANCE + MUSIC_INFO);
        screen = ph < MUSIC_DANCE ? "music" : (ph - MUSIC_DANCE < MUSIC_INFO / 2 ? "time" : "date");
      } else {
        screen = ["time", "date", "weather"][Math.floor(now / DWELL) % 3];
      }
      const tr = trRef.current;
      if (screen !== tr.cur) { tr.prev = tr.cur; tr.cur = screen; tr.start = now; }

      const scale = Math.min(W / 128, H / 64) * 0.96;
      const ox = (W - 128 * scale) / 2, oy = (H - 64 * scale) / 2;
      ctx.save(); ctx.translate(ox, oy); ctx.scale(scale, scale);
      ctx.fillStyle = "#22d3ee"; ctx.textBaseline = "top";

      const centerX = (txt, y) => { const w = ctx.measureText(txt).width; ctx.fillText(txt, (128 - w) / 2, y); };

      const drawScreen = (which, yoff) => {
        ctx.save(); ctx.translate(0, yoff);
        if (which === "time") {
          let core, ap = "";
          if (fmt12) { const h = local.getHours() % 12 || 12; core = `${h}:${pad(local.getMinutes())}`; ap = local.getHours() < 12 ? "AM" : "PM"; }
          else core = `${pad(local.getHours())}:${pad(local.getMinutes())}`;
          ctx.font = "bold 26px ui-monospace, monospace"; centerX(core, 16);
          if (ap) { ctx.font = "bold 10px ui-monospace, monospace"; centerX(ap, 46); }
        } else if (which === "date") {
          ctx.font = "bold 17px ui-monospace, monospace"; centerX(WD[local.getDay()], 6);
          centerX(`${MO[local.getMonth()]} ${local.getDate()}`, 30);
          ctx.font = "10px ui-monospace, monospace"; centerX(String(local.getFullYear()), 54);
        } else if (which === "weather") {
          if (d.wxIcon) wxGlyph(64 - 8, 4, d.wxIcon);
          ctx.font = "bold 24px ui-monospace, monospace"; centerX(d.wxTemp ? `${d.wxTemp}C` : "--", 26);
          if (d.wxLoc) { ctx.font = "10px ui-sans-serif, system-ui, sans-serif"; centerX(d.wxLoc, 54); }
        } else if (which === "music") {
          ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
          centerX(d.musTitle || "Now Playing", 2);
          const b = (Math.sin(now / 220) + 1) / 2; // beat (matches firmware placeholder)
          const bars = 7, bw = 10, gp = 4, totw = bars * bw + (bars - 1) * gp, bx = (128 - totw) / 2, baseY = 46;
          for (let i = 0; i < bars; i++) {
            const lvl = b * (0.5 + 0.5 * Math.sin(now / 120 + i * 0.9));
            const hgt = 4 + lvl * 22;
            ctx.fillRect(bx + i * (bw + gp), baseY - hgt, bw, hgt);
          }
          if (d.musArtist) { ctx.font = "9px ui-sans-serif, system-ui, sans-serif"; centerX(d.musArtist, 54); }
        }
        ctx.restore();
      };

      const p = tr.start ? (now - tr.start) / TRANS : 1;
      if (p < 1) {
        const e = 1 - (1 - p) * (1 - p); // easeOut
        drawScreen(tr.prev, -e * 64);    // current slides up & out
        drawScreen(tr.cur, (1 - e) * 64); // next slides in from below
      } else {
        drawScreen(tr.cur, 0);
      }

      ctx.restore();
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className={`robot-canvas ${className}`} />;
}
