import { Save, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Panel, SelectField, TextField } from "../components/Controls.jsx";
import { ReactionForm } from "../components/Editors.jsx";
import { RobotFaceCanvas } from "../components/RobotFaceCanvas.jsx";

export function FaceCreator({ state }) {
  const { actions } = state;
  const [editingId, setEditingId] = useState(state.currentReaction.id);
  const [templateName, setTemplateName] = useState("Custom Face Template");

  useEffect(() => {
    setEditingId(state.currentReaction.id);
  }, [state.currentReaction.id]);

  const editingReaction = useMemo(
    () => state.reactions[editingId] || state.currentReaction,
    [editingId, state.currentReaction, state.reactions],
  );

  const reactionOptions = state.orderedReactions.map((reaction) => ({
    value: reaction.id,
    label: `${reaction.code} / ${reaction.name}`,
  }));

  return (
    <div className="creator-layout">
      <Panel className="creator-preview">
        <div className="canvas-header">
          <div>
            <h2 className="section-title">Face Creator</h2>
            <p className="microcopy">Visual editor for ESP32 eye geometry, rotation, blink, animation, and display text</p>
          </div>
          <div className="live-chip">EDITING</div>
        </div>
        <RobotFaceCanvas reaction={editingReaction} settings={state.settings} />
      </Panel>

      <div className="side-stack">
        <Panel title="Template Control">
          <div className="stack">
            <SelectField
              label="Reaction"
              value={editingReaction.id}
              options={reactionOptions}
              onChange={(id) => setEditingId(id)}
            />
            <TextField label="Template Name" value={templateName} onChange={setTemplateName} />
            <Button
              variant="primary"
              onClick={() => actions.saveFaceTemplate(templateName, state.orderedReactions.map((reaction) => reaction.id))}
            >
              <Save size={16} />
              Save Template
            </Button>
            <Button variant="secondary" onClick={() => actions.selectReaction(editingReaction)}>
              <Send size={16} />
              Send to Device
            </Button>
          </div>
        </Panel>

        <Panel title="Position Matrix">
          <div className="position-matrix">
            <span>Left X</span>
            <strong>{editingReaction.leftX}px</strong>
            <span>Right X</span>
            <strong>{editingReaction.rightX}px</strong>
            <span>Left Angle</span>
            <strong>{editingReaction.leftAngle}deg</strong>
            <span>Right Angle</span>
            <strong>{editingReaction.rightAngle}deg</strong>
          </div>
        </Panel>

        <Panel title="Active Template">
          <div className="template-list">
            {state.orderedFaces.map((face) => (
              <button
                className={`template-row ${state.settings.defaultFaceId === face.id ? "template-row-active" : ""}`}
                key={face.id}
                type="button"
                onClick={() => actions.updateSettings({ defaultFaceId: face.id })}
              >
                <Sparkles size={16} />
                <span>
                  <strong>{face.name}</strong>
                  <small>{face.reactionIds?.length || 0} reactions</small>
                </span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="wide-panel" title="Visual Reaction Controls">
        <ReactionForm
          reaction={editingReaction}
          onChange={(reaction) => {
            actions.upsertReaction(reaction);
            setEditingId(reaction.id);
          }}
        />
      </Panel>
    </div>
  );
}
