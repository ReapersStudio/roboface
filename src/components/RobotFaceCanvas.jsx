import { useEffect, useRef } from "react";

const DESIGN_WIDTH = 800;
const DESIGN_HEIGHT = 480;
const DESIGN_CENTER_X = DESIGN_WIDTH / 2;
const DESIGN_CENTER_Y = DESIGN_HEIGHT / 2;
const QUARTER_PI = Math.PI / 4;
const TWO_PI = Math.PI * 2;

const lerp = (from, to, speed) => from + (to - from) * speed;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const randomRange = (min, max) => min + Math.random() * (max - min);
const degToRad = (value) => (Number(value || 0) * Math.PI) / 180;
const radToDeg = (value) => (value * 180) / Math.PI;
const rgba = (r, g, b, alpha) => `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 255) / 255})`;

const roundRect = (ctx, x, y, width, height, radius) => {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
};

const roundRectCenter = (ctx, x, y, width, height, radius) => {
  roundRect(ctx, x - width / 2, y - height / 2, width, height, radius);
};

const drawTeardrop = (ctx, x, y, size, alpha) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = rgba(0, 200, 255, alpha);
  ctx.beginPath();
  ctx.moveTo(0, -size * 2);
  ctx.bezierCurveTo(size, -size, size, size, 0, size);
  ctx.bezierCurveTo(-size, size, -size, -size, 0, -size * 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const baseTargetFromReaction = (reaction) => {
  const target = {
    leftX: DESIGN_CENTER_X + Number(reaction.leftX ?? -80),
    leftY: DESIGN_CENTER_Y + Number(reaction.leftY ?? 0),
    leftW: Number(reaction.eyeWidth ?? 130),
    leftH: Number(reaction.eyeHeight ?? 120),
    leftAngle: Number(reaction.leftAngle ?? 0),
    rightX: DESIGN_CENTER_X + Number(reaction.rightX ?? 80),
    rightY: DESIGN_CENTER_Y + Number(reaction.rightY ?? 0),
    rightW: Number(reaction.eyeWidth ?? 130),
    rightH: Number(reaction.eyeHeight ?? 120),
    rightAngle: Number(reaction.rightAngle ?? 0),
    normalAlpha: 255,
    curveAlpha: 0,
    bulbAlpha: 0,
    sweatAlpha: 0,
    veinAlpha: 0,
    zzzAlpha: 0,
  };

  if (reaction.code === 3 || reaction.feature === "sweat") target.sweatAlpha = 255;
  if (reaction.code === 5 || reaction.feature === "vein") target.veinAlpha = 255;
  if (reaction.code === 6 || reaction.feature === "curve") {
    target.normalAlpha = 0;
    target.curveAlpha = 255;
  }
  if (reaction.code === 7 || reaction.feature === "zzz") target.zzzAlpha = 255;
  if (reaction.code === 8 || reaction.feature === "bulb") {
    target.normalAlpha = 0;
    target.bulbAlpha = 255;
  }

  return target;
};

const applyExactMotion = (target, reaction, time) => {
  const next = { ...target };
  const baseLeftX = DESIGN_CENTER_X + Number(reaction.leftX ?? -80);
  const baseRightX = DESIGN_CENTER_X + Number(reaction.rightX ?? 80);
  const code = Number(reaction.code);

  if (code === 0) {
    const breath = Math.sin(time / 600) * 4;
    next.leftY = DESIGN_CENTER_Y + breath;
    next.rightY = DESIGN_CENTER_Y + breath;

    const cycle = time % 10000;
    if (cycle < 1500) {
      next.leftX = baseLeftX + 25;
      next.rightX = baseRightX + 25;
    } else if (cycle > 4500 && cycle < 6000) {
      next.leftX = baseLeftX - 25;
      next.rightX = baseRightX - 25;
    } else {
      next.leftX = baseLeftX;
      next.rightX = baseRightX;
    }
  } else if (code === 3) {
    next.leftX = baseLeftX + randomRange(-3, 3);
    next.rightX = baseRightX + randomRange(-3, 3);
  } else if (code === 6) {
    const bounce = Math.abs(Math.sin(time / 150)) * 25;
    next.leftY = DESIGN_CENTER_Y - bounce + 10;
    next.rightY = DESIGN_CENTER_Y - bounce + 10;
  } else if (code === 8) {
    const floaty = Math.sin(time / 300) * 10;
    next.leftY = DESIGN_CENTER_Y - 30 + floaty;
    next.rightY = DESIGN_CENTER_Y - 30 + floaty;
    next.leftAngle = radToDeg(Math.sin(time / 200) * 0.1);
    next.rightAngle = radToDeg(-Math.sin(time / 200) * 0.1);
  } else if (code === 9) {
    const pan = Math.sin(time / 800) * 10;
    next.leftX = baseLeftX + pan;
    next.rightX = baseRightX + pan;
  } else if (code === 11) {
    const bob = Math.sin(time / 150) * 15;
    const angle = -0.1 + Math.sin(time / 200) * 0.15;
    next.leftY = DESIGN_CENTER_Y - 30 + bob;
    next.rightY = DESIGN_CENTER_Y - 30 + bob;
    next.leftAngle = radToDeg(angle);
    next.rightAngle = radToDeg(angle);
  } else if (code === 12) {
    const danceTime = time / 150;
    const shift = Math.sin(danceTime) * 40;
    const bounce = Math.abs(Math.cos(danceTime)) * 30 - 15;
    const height = 100 - Math.abs(Math.cos(danceTime)) * 30;
    const angle = radToDeg(Math.sin(danceTime) * 0.3);
    next.leftX = baseLeftX + shift;
    next.rightX = baseRightX + shift;
    next.leftY = DESIGN_CENTER_Y + bounce;
    next.rightY = DESIGN_CENTER_Y + bounce;
    next.leftAngle = angle;
    next.rightAngle = angle;
    next.leftH = height;
    next.rightH = height;
  }

  return next;
};

const drawRectEye = (ctx, eye, alpha, blinkFactor) => {
  const height = Math.max(2, eye.h * blinkFactor);

  ctx.save();
  ctx.translate(eye.x, eye.y);
  ctx.rotate(degToRad(eye.angle));
  ctx.shadowColor = rgba(0, 255, 255, alpha);
  ctx.shadowBlur = 14;
  ctx.fillStyle = rgba(0, 255, 255, alpha);
  roundRectCenter(ctx, 0, 0, eye.w, height, 25);
  ctx.fill();
  ctx.restore();
};

const drawCurveEye = (ctx, eye, alpha) => {
  ctx.save();
  ctx.translate(eye.x, eye.y + 25);
  ctx.rotate(degToRad(eye.angle));
  ctx.strokeStyle = rgba(0, 255, 255, alpha);
  ctx.shadowColor = rgba(0, 255, 255, alpha);
  ctx.shadowBlur = 14;
  ctx.lineWidth = 25;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, 60, Math.PI + QUARTER_PI, TWO_PI - QUARTER_PI);
  ctx.stroke();
  ctx.restore();
};

const drawBulb = (ctx, eye, alpha, bulbOn, time) => {
  let currentAlpha = alpha;
  if (bulbOn && Math.random() < 0.15) {
    currentAlpha = alpha * randomRange(0.5, 0.9);
  }

  const body = bulbOn ? [255, 255, 0] : [80, 80, 80];
  const core = bulbOn ? [255, 255, 200] : [50, 50, 50];

  ctx.save();
  ctx.translate(eye.x, eye.y);
  ctx.rotate(degToRad(eye.angle));
  ctx.shadowColor = rgba(body[0], body[1], body[2], currentAlpha);
  ctx.shadowBlur = bulbOn ? 22 : 8;
  ctx.fillStyle = rgba(body[0], body[1], body[2], currentAlpha);
  ctx.beginPath();
  ctx.ellipse(0, -20, 55, 55, 0, 0, TWO_PI);
  ctx.fill();
  roundRectCenter(ctx, 0, 45, 40, 50, 5);
  ctx.fill();

  ctx.fillStyle = rgba(core[0], core[1], core[2], currentAlpha);
  ctx.beginPath();
  ctx.ellipse(0, -20, 25, 25, 0, 0, TWO_PI);
  ctx.fill();

  if (bulbOn) {
    ctx.strokeStyle = rgba(255, 255, 0, currentAlpha);
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-70, -70);
    ctx.lineTo(-50, -50);
    ctx.moveTo(0, -95);
    ctx.lineTo(0, -65);
    ctx.moveTo(70, -70);
    ctx.lineTo(50, -50);
    ctx.stroke();
  }

  ctx.restore();
};

const overlayText = (settings) => {
  const now = new Date();
  const parts = [];

  if (settings.showDate) {
    parts.push(now.toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }));
  }

  if (settings.showTime) {
    parts.push(
      now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: settings.format === "12h",
      }),
    );
  }

  return parts.join("  ");
};

export function RobotFaceCanvas({ reaction, settings, className = "" }) {
  const canvasRef = useRef(null);
  const currentRef = useRef(null);
  const blinkRef = useRef({
    nextBlinkTime: performance.now() + 2000,
    isBlinking: false,
    blinkStartTime: 0,
  });
  const ideaStartRef = useRef(performance.now());

  useEffect(() => {
    if (reaction.code === 8) {
      ideaStartRef.current = performance.now();
    }
  }, [reaction.code, reaction.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrame = 0;

    const render = (time) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(320, rect.width);
      const height = Math.max(240, rect.height);

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgb(15, 15, 15)";
      ctx.fillRect(0, 0, width, height);

      const speed = Number(settings.animationSpeed || 1);
      const animationTime = time * speed;
      const target = applyExactMotion(baseTargetFromReaction(reaction), reaction, animationTime);

      if (!currentRef.current) {
        currentRef.current = { ...target };
      }

      const current = currentRef.current;
      const interpolationSpeed = 0.15;
      Object.keys(target).forEach((key) => {
        current[key] = lerp(current[key], target[key], interpolationSpeed);
      });

      const blinkState = blinkRef.current;
      let blinkFactor = 1;
      const blinkEnabled = Boolean(settings.preview.blinking && reaction.blink);

      if (blinkEnabled && time > blinkState.nextBlinkTime && !blinkState.isBlinking) {
        if (target.normalAlpha > 100 && target.leftH > 40) {
          blinkState.isBlinking = true;
          blinkState.blinkStartTime = time;
        }
        blinkState.nextBlinkTime = time + randomRange(2000, 6000);
      }

      if (blinkState.isBlinking) {
        const elapsed = time - blinkState.blinkStartTime;
        const blinkDuration = 150;
        if (elapsed < blinkDuration / 2) {
          blinkFactor = 1 - (elapsed / (blinkDuration / 2)) * 0.95;
        } else if (elapsed < blinkDuration) {
          blinkFactor = 0.05 + ((elapsed - blinkDuration / 2) / (blinkDuration / 2)) * 0.95;
        } else {
          blinkState.isBlinking = false;
          blinkFactor = 1;
          if (Math.random() < 0.2) {
            blinkState.nextBlinkTime = time + 100;
          }
        }
      }

      const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT) * 0.94;
      const offsetX = (width - DESIGN_WIDTH * scale) / 2;
      const offsetY = (height - DESIGN_HEIGHT * scale) / 2;

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      const leftEye = {
        x: current.leftX,
        y: current.leftY,
        w: current.leftW,
        h: current.leftH,
        angle: current.leftAngle,
      };
      const rightEye = {
        x: current.rightX,
        y: current.rightY,
        w: current.rightW,
        h: current.rightH,
        angle: current.rightAngle,
      };

      if (current.normalAlpha > 1) {
        drawRectEye(ctx, leftEye, current.normalAlpha, blinkFactor);
        drawRectEye(ctx, rightEye, current.normalAlpha, blinkFactor);
      }

      if (current.curveAlpha > 1) {
        drawCurveEye(ctx, leftEye, current.curveAlpha);
        drawCurveEye(ctx, rightEye, current.curveAlpha);
      }

      if (current.bulbAlpha > 1) {
        const bulbOn = reaction.code === 8 && time - ideaStartRef.current > 500;
        drawBulb(ctx, leftEye, current.bulbAlpha, bulbOn, animationTime);
        drawBulb(ctx, rightEye, current.bulbAlpha, bulbOn, animationTime);
      }

      if (current.sweatAlpha > 1) {
        const drip = ((animationTime % 1000) / 1000) * 20;
        drawTeardrop(ctx, DESIGN_CENTER_X - 80 - 90, DESIGN_CENTER_Y - 60 + drip, 22, current.sweatAlpha);
        drawTeardrop(ctx, DESIGN_CENTER_X + 80 + 90, DESIGN_CENTER_Y + 30 + drip, 18, current.sweatAlpha);
        drawTeardrop(ctx, DESIGN_CENTER_X + 80 + 120, DESIGN_CENTER_Y - 45 + drip, 15, current.sweatAlpha);
      }

      if (current.veinAlpha > 1) {
        const shakeX = randomRange(-3, 3);
        const shakeY = randomRange(-3, 3);
        ctx.save();
        ctx.translate(shakeX, shakeY);
        ctx.strokeStyle = rgba(255, 50, 50, current.veinAlpha);
        ctx.shadowColor = rgba(255, 50, 50, current.veinAlpha);
        ctx.shadowBlur = 10;
        ctx.lineWidth = 10;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(DESIGN_CENTER_X + 80 + 80, DESIGN_CENTER_Y - 90);
        ctx.lineTo(DESIGN_CENTER_X + 80 + 105, DESIGN_CENTER_Y - 60);
        ctx.lineTo(DESIGN_CENTER_X + 80 + 90, DESIGN_CENTER_Y - 35);
        ctx.lineTo(DESIGN_CENTER_X + 80 + 125, DESIGN_CENTER_Y - 15);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(DESIGN_CENTER_X + 80 + 105, DESIGN_CENTER_Y - 60);
        ctx.lineTo(DESIGN_CENTER_X + 80 + 140, DESIGN_CENTER_Y - 75);
        ctx.stroke();
        ctx.restore();
      }

      if (current.zzzAlpha > 1) {
        const zTime = animationTime / 500;
        const riseA = (animationTime % 2000) / 20;
        const riseB = ((animationTime + 600) % 2000) / 20;
        const riseC = ((animationTime + 1200) % 2000) / 20;
        ctx.save();
        ctx.fillStyle = rgba(255, 255, 255, current.zzzAlpha);
        ctx.textAlign = "center";
        ctx.font = "60px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText("Z", DESIGN_CENTER_X + 80 + 10 + Math.sin(zTime) * 10, DESIGN_CENTER_Y - riseA);
        ctx.font = "45px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText("z", DESIGN_CENTER_X + 80 + 30 + Math.sin(zTime + 1) * 10, DESIGN_CENTER_Y - 40 - riseB);
        ctx.font = "35px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText("z", DESIGN_CENTER_X + 80 + 50 + Math.sin(zTime + 2) * 10, DESIGN_CENTER_Y - 80 - riseC);
        ctx.restore();
      }

      ctx.restore();

      if (settings.overlay.enabled) {
        const text = overlayText(settings.overlay);
        ctx.save();
        ctx.font = `600 ${settings.overlay.size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillStyle = settings.overlay.color;
        ctx.shadowColor = settings.overlay.color;
        ctx.shadowBlur = 14;
        const metrics = ctx.measureText(text);
        const padding = 12;
        let x = settings.overlay.offsetX;
        let y = settings.overlay.offsetY + settings.overlay.size;

        if (settings.overlay.position.includes("right")) x = width - metrics.width - settings.overlay.offsetX;
        if (settings.overlay.position.includes("bottom")) y = height - settings.overlay.offsetY;
        if (settings.overlay.position === "center") {
          x = width / 2 - metrics.width / 2;
          y = height / 2 + settings.overlay.size / 2;
        }

        ctx.fillStyle = "rgba(3, 8, 20, 0.62)";
        roundRect(ctx, x - padding, y - settings.overlay.size - padding / 2, metrics.width + padding * 2, settings.overlay.size + padding, 10);
        ctx.fill();
        ctx.fillStyle = settings.overlay.color;
        ctx.fillText(text, x, y);
        ctx.restore();
      }

      animationFrame = window.requestAnimationFrame(render);
    };

    animationFrame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [reaction, settings]);

  return <canvas ref={canvasRef} className={`robot-canvas ${className}`} />;
}
