import { useEffect, useRef } from "react";

// Live preview of the robot eyes — ports the firmware's emotion animations so
// the web app matches the OLED (rounded cyan eyes on black).
export function EmotionEyes({ emotion = "idle", className = "" }) {
  const canvasRef = useRef(null);
  const startRef = useRef(performance.now());
  const blinkRef = useRef({ next: 3000, on: false, start: 0 });

  useEffect(() => {
    startRef.current = performance.now();
  }, [emotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf = 0;

    const round = (x, y, w, h, r) => {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
      ctx.fill();
    };

    const render = (now) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const W = Math.max(160, rect.width);
      const H = Math.max(120, rect.height);
      if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#070a12";
      ctx.fillRect(0, 0, W, H);

      // work in a 128x64 "panel" space, scaled & centered
      const scale = Math.min(W / 128, H / 64) * 0.92;
      const ox = (W - 128 * scale) / 2;
      const oy = (H - 64 * scale) / 2;

      const t = now;
      const e = now - startRef.current;
      const baseW = 34, baseH = 40, gap = 16, cy = 32;
      let lcx = 64 - gap / 2 - baseW / 2;
      let rcx = 64 + gap / 2 + baseW / 2;
      let lw = baseW, lh = baseH, rw = baseW, rh = baseH, loff = 0, roff = 0, lxo = 0, rxo = 0;

      switch (emotion) {
        case "happy": loff = roff = -Math.abs(Math.sin(t / 180)) * 6; lh = rh = baseH * 0.8; break;
        case "sleep": lh = rh = 4; loff = roff = baseH / 2 - 2; break;
        case "wake": { const k = Math.min(1, e / 600); lh = rh = 4 + (baseH - 4) * k; } break;
        case "listening": lw = rw = baseW * 1.12; lh = rh = baseH * 1.12; break;
        case "thinking": lxo = 8; rxo = -8; loff = roff = -6; break;
        case "curious": lh = baseH * 1.2; lw = baseW * 1.1; rh = baseH * 0.85; rw = baseW * 0.9; break;
        case "excited": loff = roff = -Math.abs(Math.sin(t / 90)) * 8; break;
        case "love": { const p = (Math.sin(t / 350) + 1) / 2; lw = rw = baseW * (0.9 + 0.2 * p); lh = rh = baseH * (0.9 + 0.2 * p); } break;
        case "music": { const b = (Math.sin(t / 220) + 1) / 2; lh = rh = baseH * (0.85 + 0.4 * b); lw = rw = baseW * (0.9 + 0.15 * b); } break;
        default: loff = roff = Math.sin(t / 700) * 2; // idle
      }

      // blink (skip when sleeping/waking)
      let bf = 1;
      const bs = blinkRef.current;
      const canBlink = emotion !== "sleep" && emotion !== "wake";
      if (canBlink && t > bs.next && !bs.on) { bs.on = true; bs.start = t; bs.next = t + 2500 + Math.random() * 3500; }
      if (bs.on) {
        const be = t - bs.start, d = 140;
        if (be < d / 2) bf = 1 - (be / (d / 2)) * 0.92;
        else if (be < d) bf = 0.08 + ((be - d / 2) / (d / 2)) * 0.92;
        else bs.on = false;
      }

      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);
      ctx.fillStyle = "#22d3ee";
      ctx.shadowColor = "rgba(34,211,238,0.7)";
      ctx.shadowBlur = 10;
      const eye = (cx, cyy, w, h) => {
        const hh = Math.max(2, h);
        round(cx - w / 2, cyy - hh / 2, w, hh, Math.min(10, w / 2, hh / 2));
      };
      eye(lcx + lxo, cy + loff, lw, lh * bf);
      eye(rcx + rxo, cy + roff, rw, rh * bf);
      ctx.restore();

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [emotion]);

  return <canvas ref={canvasRef} className={`robot-canvas ${className}`} />;
}
