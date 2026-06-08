import { ANIMATION_OPTIONS } from "../data/defaults.js";
import { SelectField, SliderField, SwatchField, TextField, Toggle } from "./Controls.jsx";

export const eyeOptions = [
  { value: "rect", label: "Rect" },
  { value: "curve", label: "Curve" },
  { value: "bulb", label: "Bulb" },
  { value: "round", label: "Round" },
  { value: "wide", label: "Wide" },
  { value: "happy", label: "Happy Arc" },
  { value: "closed", label: "Closed" },
  { value: "droop", label: "Droop" },
  { value: "left", label: "Look Left" },
  { value: "right", label: "Look Right" },
  { value: "side", label: "Side Eye" },
  { value: "angry", label: "Angry" },
];

export const mouthOptions = [
  { value: "none", label: "None" },
  { value: "line", label: "Line" },
  { value: "flat", label: "Flat" },
  { value: "smile", label: "Smile" },
  { value: "frown", label: "Frown" },
  { value: "open", label: "Open" },
  { value: "wobble", label: "Wobble" },
  { value: "soft", label: "Soft" },
];

export function ReactionForm({ reaction, onChange }) {
  const patch = (value) => onChange({ ...reaction, ...value });

  return (
    <div className="editor-grid">
      <TextField
        label="Name"
        value={reaction.name}
        onChange={(name) => patch({ name })}
      />
      <TextField
        label="Code"
        type="number"
        value={reaction.code}
        onChange={(code) => patch({ code: Number(code) })}
      />
      <TextField
        label="ESP32 Reaction"
        value={reaction.reaction}
        onChange={(value) => patch({ reaction: value })}
      />
      <TextField
        label="Mood"
        value={reaction.mood}
        onChange={(mood) => patch({ mood })}
      />
      <SwatchField
        label="Glow Color"
        value={reaction.color}
        onChange={(color) => patch({ color })}
      />
      <SelectField
        label="Animation"
        value={reaction.animation}
        options={ANIMATION_OPTIONS}
        onChange={(animation) => patch({ animation })}
      />
      <SelectField
        label="Eye Shape"
        value={reaction.eye}
        options={eyeOptions}
        onChange={(eye) => patch({ eye })}
      />
      <SelectField
        label="Mouth"
        value={reaction.mouth}
        options={mouthOptions}
        onChange={(mouth) => patch({ mouth })}
      />
      <TextField
        label="Custom Text"
        value={reaction.customText}
        onChange={(customText) => patch({ customText })}
      />
      <SliderField
        label="Intensity"
        value={reaction.intensity}
        min={10}
        max={100}
        suffix="%"
        onChange={(intensity) => patch({ intensity })}
      />
      <SliderField
        label="Eye Width"
        value={reaction.eyeWidth}
        min={20}
        max={170}
        suffix="px"
        onChange={(eyeWidth) => patch({ eyeWidth })}
      />
      <SliderField
        label="Eye Height"
        value={reaction.eyeHeight}
        min={10}
        max={140}
        suffix="px"
        onChange={(eyeHeight) => patch({ eyeHeight })}
      />
      <SliderField
        label="Left X"
        value={reaction.leftX}
        min={-180}
        max={40}
        suffix="px"
        onChange={(leftX) => patch({ leftX })}
      />
      <SliderField
        label="Right X"
        value={reaction.rightX}
        min={-40}
        max={180}
        suffix="px"
        onChange={(rightX) => patch({ rightX })}
      />
      <SliderField
        label="Left Y"
        value={reaction.leftY}
        min={-90}
        max={90}
        suffix="px"
        onChange={(leftY) => patch({ leftY })}
      />
      <SliderField
        label="Right Y"
        value={reaction.rightY}
        min={-90}
        max={90}
        suffix="px"
        onChange={(rightY) => patch({ rightY })}
      />
      <SliderField
        label="Left Angle"
        value={reaction.leftAngle}
        min={-35}
        max={35}
        suffix="deg"
        onChange={(leftAngle) => patch({ leftAngle })}
      />
      <SliderField
        label="Right Angle"
        value={reaction.rightAngle}
        min={-35}
        max={35}
        suffix="deg"
        onChange={(rightAngle) => patch({ rightAngle })}
      />
      <Toggle
        label="Blink"
        checked={reaction.blink}
        onChange={(blink) => patch({ blink })}
      />
    </div>
  );
}

export function OverlayEditor({ overlay, onChange }) {
  return (
    <div className="stack">
      <Toggle
        label="Overlay enabled"
        checked={overlay.enabled}
        onChange={(enabled) => onChange({ enabled })}
      />
      <div className="editor-grid">
        <Toggle
          label="Date"
          checked={overlay.showDate}
          onChange={(showDate) => onChange({ showDate })}
        />
        <Toggle
          label="Time"
          checked={overlay.showTime}
          onChange={(showTime) => onChange({ showTime })}
        />
        <SelectField
          label="Format"
          value={overlay.format}
          onChange={(format) => onChange({ format })}
          options={[
            { value: "24h", label: "24 hour" },
            { value: "12h", label: "12 hour" },
          ]}
        />
        <SelectField
          label="Position"
          value={overlay.position}
          onChange={(position) => onChange({ position })}
          options={[
            { value: "top-left", label: "Top Left" },
            { value: "top-right", label: "Top Right" },
            { value: "bottom-left", label: "Bottom Left" },
            { value: "bottom-right", label: "Bottom Right" },
            { value: "center", label: "Center" },
          ]}
        />
        <SwatchField label="Color" value={overlay.color} onChange={(color) => onChange({ color })} />
        <SliderField label="Size" value={overlay.size} min={10} max={30} suffix="px" onChange={(size) => onChange({ size })} />
        <SliderField label="Offset X" value={overlay.offsetX} min={0} max={80} suffix="px" onChange={(offsetX) => onChange({ offsetX })} />
        <SliderField label="Offset Y" value={overlay.offsetY} min={0} max={80} suffix="px" onChange={(offsetY) => onChange({ offsetY })} />
      </div>
    </div>
  );
}

export function TransitionEditor({ transition, onChange }) {
  return (
    <div className="editor-grid">
      <SliderField
        label="Duration"
        value={transition.duration}
        min={80}
        max={1200}
        step={20}
        suffix="ms"
        onChange={(duration) => onChange({ duration })}
      />
      <SelectField
        label="Easing"
        value={transition.easing}
        onChange={(easing) => onChange({ easing })}
        options={[
          { value: "ease-out", label: "Ease Out" },
          { value: "linear", label: "Linear" },
        ]}
      />
      <SliderField
        label="Eye Shift"
        value={transition.eyeShift}
        min={0}
        max={60}
        suffix="px"
        onChange={(eyeShift) => onChange({ eyeShift })}
      />
      <SliderField
        label="Mouth Morph"
        value={transition.mouthMorph}
        min={0}
        max={100}
        suffix="%"
        onChange={(mouthMorph) => onChange({ mouthMorph })}
      />
      <SliderField
        label="Glow"
        value={transition.glow}
        min={0}
        max={120}
        suffix="%"
        onChange={(glow) => onChange({ glow })}
      />
    </div>
  );
}
