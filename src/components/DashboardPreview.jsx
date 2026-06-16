import { useEffect, useRef } from "react";

// Live preview of the RIGHT (dashboard) panel — mirrors the firmware:
// date (top-left), weather icon+temp (top-right), big clock, now-playing/location.
export function DashboardPreview({ device = {}, settings = {}, emotion = "idle", className = "" }) {
  const canvasRef = useRef(null);
  const dataRef = useRef({ device, settings });
  dataRef.current = { device, settings };

  // restart the slide-in whenever the emotion changes (synced with the eyes)
  const transRef = useRef(0);
  useEffect(() => {
    transRef.current = performance.now();
  }, [emotion]);

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

      const scale = Math.min(W / 128, H / 64) * 0.96;
      const ox = (W - 128 * scale) / 2, oy = (H - 64 * scale) / 2;
      // slide-in offset (matches firmware dashSlideY: -10 -> 0, easeOut, 320ms)
      const te = now - transRef.current;
      let dy = 0;
      if (te < 320) { const k = te / 320; dy = (1 - (1 - (1 - k) * (1 - k))) * -10; }

      ctx.save(); ctx.translate(ox, oy + dy); ctx.scale(scale, scale);
      ctx.fillStyle = "#22d3ee"; ctx.textBaseline = "top";

      const dt = new Date();
      const fmt12 = s.display?.timeFormat === "12h";
      const region = s.display?.region;
      const tz = region && region !== "auto" ? { timeZone: region } : {};
      const wd = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      const mo = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const local = new Date(dt.toLocaleString("en-US", tz));

      // date top-left
      ctx.font = "bold 8px ui-monospace, monospace";
      ctx.fillText(`${wd[local.getDay()]} ${mo[local.getMonth()]} ${local.getDate()}`, 0, 1);

      // weather top-right
      if (d.wxTemp != null && String(d.wxTemp).length) {
        const tdeg = `${d.wxTemp}C`;
        ctx.font = "bold 8px ui-monospace, monospace";
        const tw = ctx.measureText(tdeg).width;
        ctx.fillText(tdeg, 128 - tw, 1);
        if (d.wxIcon) wxGlyph(128 - tw - 20, 0, d.wxIcon);
      }

      // big clock
      const hhmm = local.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: fmt12, ...tz });
      ctx.font = "bold 22px ui-monospace, monospace";
      const cw = ctx.measureText(hhmm).width;
      ctx.fillText(hhmm, (128 - cw) / 2, 22);

      // bottom: now-playing (marquee) or location
      ctx.font = "8px ui-sans-serif, system-ui, sans-serif";
      if (d.musPlaying && d.musTitle) {
        const np = d.musTitle + (d.musArtist ? " - " + d.musArtist : "");
        const npw = ctx.measureText(np).width;
        if (npw <= 128) ctx.fillText(np, (128 - npw) / 2, 54);
        else {
          const total = npw + 30;
          const off = (now / 50) % total;
          ctx.save();
          ctx.beginPath(); ctx.rect(0, 53, 128, 11); ctx.clip();
          ctx.fillText(np + "      " + np, -off, 54);
          ctx.restore();
        }
      } else if (d.wxLoc) {
        const lw = ctx.measureText(d.wxLoc).width;
        ctx.fillText(d.wxLoc, (128 - lw) / 2, 54);
      }

      ctx.restore();
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className={`robot-canvas ${className}`} />;
}
