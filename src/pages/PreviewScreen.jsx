import { Maximize2 } from "lucide-react";
import { Button, Panel, Toggle } from "../components/Controls.jsx";
import { ReactionRail } from "../components/ReactionRail.jsx";
import { RobotFaceCanvas } from "../components/RobotFaceCanvas.jsx";

export function PreviewScreen({ state }) {
  const { actions } = state;

  return (
    <div className="preview-screen">
      <Panel className="preview-stage">
        <div className="canvas-header">
          <div>
            <h2 className="section-title">Preview Screen</h2>
            <p className="microcopy">Fullscreen-grade canvas output for face tuning</p>
          </div>
          <Button variant="ghost">
            <Maximize2 size={16} />
            Stage
          </Button>
        </div>
        <RobotFaceCanvas reaction={state.currentReaction} settings={state.settings} />
      </Panel>

      <div className="preview-controls">
        <Panel title="Animation Preview">
          <div className="stack">
            <Toggle
              label="Blinking"
              checked={state.settings.preview.blinking}
              onChange={(blinking) => actions.updatePreview({ blinking })}
            />
            <Toggle
              label="Breathing"
              checked={state.settings.preview.breathing}
              onChange={(breathing) => actions.updatePreview({ breathing })}
            />
            <Toggle
              label="Auto cycle"
              checked={state.control.autoCycle}
              onChange={actions.toggleAutoCycle}
            />
          </div>
        </Panel>
        <Panel title="Quick Reactions">
          <ReactionRail
            reactions={state.orderedReactions}
            currentReactionId={state.control.currentReactionId}
            onSelect={actions.selectReaction}
            onReorder={actions.reorderReactions}
            compact
          />
        </Panel>
      </div>
    </div>
  );
}
