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
      const baseW = 40, baseH = 48, gap = 14, cy = 32; // EMO-style: big, tall, close
      let lcx = 64 - gap / 2 - baseW / 2;
      let rcx = 64 + gap / 2 + baseW / 2;
      let lw = baseW, lh = baseH, rw = baseW, rh = baseH, loff = 0, roff = 0, lxo = 0, rxo = 0;
      let lOpen = 1, rOpen = 1, browMode = 0, browTilt = 0, tear = false;

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
        // ---- EMO-style additions (mirror the firmware drawEyes) ----
        case "angry": { lh = rh = baseH * 0.6; loff = roff = 4; const j = Math.sin(t / 55) * 1; lxo = j; rxo = -j; browMode = 1; browTilt = 7; } break;
        case "sad": { lh = rh = baseH * 0.7; lw = rw = baseW * 0.95; loff = roff = 7 + Math.sin(t / 900) * 2; browMode = 2; browTilt = 6; tear = Math.floor(t / 2200) % 2 === 0; } break;
        case "surprised": { lw = rw = baseW * 1.28; lh = rh = baseH * 1.3; loff = roff = -3; browMode = 3; } break;
        case "wink": { const ph = t % 1600; lOpen = ph < 300 ? 0.08 : 1; loff = roff = -Math.abs(Math.sin(t / 200)) * 3; } break;
        case "dizzy": { const a = t / 260; lxo = Math.cos(a) * 5; loff = Math.sin(a) * 4; rxo = Math.cos(a + Math.PI) * 5; roff = Math.sin(a + Math.PI) * 4; lw = rw = baseW * 0.9; lh = rh = baseH * 0.9; } break;
        case "skeptical": { lOpen = 0.45; loff = -3; lxo = rxo = 5; browMode = 4; browTilt = 5; } break;
        case "laugh": { loff = roff = -Math.abs(Math.sin(t / 110)) * 9; lh = rh = baseH * 0.5; const sh = Math.sin(t / 70) * 2; lxo = sh; rxo = sh; } break;
        default: loff = roff = Math.sin(t / 700) * 2; // idle
      }

      // blink (skip when sleeping/waking/winking/cool)
      let bf = 1;
      const bs = blinkRef.current;
      const canBlink = !["sleep", "wake", "wink"].includes(emotion);
      if (canBlink && t > bs.next && !bs.on) { bs.on = true; bs.start = t; bs.next = t + 2500 + Math.random() * 3500; }
      if (bs.on) {
        const be = t - bs.start, d = 140;
        if (be < d / 2) bf = 1 - (be / (d / 2)) * 0.92;
        else if (be < d) bf = 0.08 + ((be - d / 2) / (d / 2)) * 0.92;
        else bs.on = false;
      }

      // blink-morph transition into the new emotion (matches firmware EMO_TRANS_MS)
      let env = 1;
      if (e < 320) env = 0.06 + 0.94 * Math.abs((e / 320) * 2 - 1);
      bf *= env;

      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);
      ctx.fillStyle = "#22d3ee";
      ctx.strokeStyle = "#22d3ee";
      ctx.shadowColor = "rgba(34,211,238,0.7)";
      ctx.shadowBlur = 10;
      const eye = (cx, cyy, w, h) => {
        const hh = Math.max(2, h);
        round(cx - w / 2, cyy - hh / 2, w, hh, Math.min(w, hh) / 3); // EMO rounded rectangle
      };
      const brow = (cx, y, leftEye, tilt, len) => {
        const half = len / 2;
        const innerX = leftEye ? cx + half : cx - half;
        const outerX = leftEye ? cx - half : cx + half;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(outerX, y - tilt);
        ctx.lineTo(innerX, y + tilt);
        ctx.stroke();
      };
      const happyEye = (cx, cyy, w, h) => {
        const R = Math.max(6, w / 2), cyi = cyy + h * 0.22;
        ctx.lineWidth = Math.max(4, R / 3);
        ctx.strokeStyle = "#22d3ee";
        ctx.beginPath(); ctx.arc(cx, cyi, R, Math.PI, 2 * Math.PI); ctx.stroke();
      };
      const heart = (cx, cyy, s) => {
        const r = Math.max(3, s * 0.28);
        ctx.beginPath();
        ctx.arc(cx - r, cyy - r / 2, r, 0, 7); ctx.arc(cx + r, cyy - r / 2, r, 0, 7);
        ctx.moveTo(cx - 2 * r, cyy - r / 2); ctx.lineTo(cx + 2 * r, cyy - r / 2);
        ctx.lineTo(cx, cyy + s * 0.5); ctx.closePath(); ctx.fill();
      };

      // cute squash-stretch pop on emotion change
      let bounce = 1;
      if (e < 420) { const p = e / 420; bounce = 1 + Math.sin(p * 6.2832) * 0.16 * (1 - p); }
      lw *= bounce; rw *= bounce; lh *= bounce; rh *= bounce;

      if (emotion === "love") {
        const beat = 1 + 0.12 * Math.sin(t / 220);
        heart(lcx + lxo, cy + loff, lw * beat);
        heart(rcx + rxo, cy + roff, rw * beat);
      } else if (emotion === "happy" || emotion === "laugh") {
        happyEye(lcx + lxo, cy + loff, lw, lh * bf);
        happyEye(rcx + rxo, cy + roff, rw, rh * bf);
      } else {
        eye(lcx + lxo, cy + loff, lw, lh * bf * lOpen);
        eye(rcx + rxo, cy + roff, rw, rh * bf * rOpen);

        if (browMode) {
          const raise = browMode === 3 ? 8 : 5;
          const byL = cy + loff - lh / 2 - raise;
          const byR = cy + roff - rh / 2 - raise;
          if (browMode === 1) { brow(lcx + lxo, byL, true, browTilt, lw); brow(rcx + rxo, byR, false, browTilt, rw); }
          else if (browMode === 2) { brow(lcx + lxo, byL, true, -browTilt, lw); brow(rcx + rxo, byR, false, -browTilt, rw); }
          else if (browMode === 3) { brow(lcx + lxo, byL, true, 0, lw); brow(rcx + rxo, byR, false, 0, rw); }
          else if (browMode === 4) { brow(lcx + lxo, byL - 3, true, -browTilt, lw); brow(rcx + rxo, byR, false, 0, rw); }
        }
        if (tear) {
          const p = (t % 1400) / 1400;
          ctx.beginPath();
          ctx.arc(lcx + lxo, cy + loff + lh / 2 + 2 + p * 18, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [emotion]);

  return <canvas ref={canvasRef} className={`robot-canvas ${className}`} />;
}
