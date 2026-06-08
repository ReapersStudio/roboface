import { Plus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Panel } from "../components/Controls.jsx";
import { ReactionForm } from "../components/Editors.jsx";
import { ReactionRail } from "../components/ReactionRail.jsx";
import { RobotFaceCanvas } from "../components/RobotFaceCanvas.jsx";

export function ReactionEditor({ state }) {
  const { actions } = state;
  const [editingId, setEditingId] = useState(state.currentReaction.id);

  const editingReaction = useMemo(
    () => state.reactions[editingId] || state.currentReaction,
    [editingId, state.currentReaction, state.reactions],
  );

  const handleSelect = (reaction) => {
    setEditingId(reaction.id);
    actions.selectReaction(reaction);
  };

  const handleRemove = (reactionId) => {
    actions.removeReaction(reactionId);
    if (editingId === reactionId) {
      setEditingId(state.orderedReactions.find((reaction) => reaction.id !== reactionId)?.id || "normal");
    }
  };

  return (
    <div className="editor-layout">
      <Panel
        title="Reaction Ordering"
        action={
          <Button variant="secondary" onClick={actions.addReaction}>
            <Plus size={16} />
            Add
          </Button>
        }
      >
        <ReactionRail
          reactions={state.orderedReactions}
          currentReactionId={editingReaction.id}
          onSelect={handleSelect}
          onReorder={actions.reorderReactions}
          onRemove={handleRemove}
          compact
        />
      </Panel>

      <Panel title="Custom Reaction Lab" className="editor-main">
        <div className="editor-preview-row">
          <RobotFaceCanvas reaction={editingReaction} settings={state.settings} />
          <div className="reaction-readout">
            <span className="reaction-code large">{editingReaction.code}</span>
            <h2>{editingReaction.name}</h2>
            <p>{editingReaction.mood}</p>
            <Button variant="primary" onClick={() => actions.selectReaction(editingReaction)}>
              Send State Now
            </Button>
          </div>
        </div>

        <ReactionForm
          reaction={editingReaction}
          onChange={(reaction) => {
            actions.upsertReaction(reaction);
            setEditingId(reaction.id);
          }}
        />

        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={actions.addReaction}>
            <Plus size={16} />
            Create Custom Reaction
          </Button>
          <Button variant="ghost" onClick={actions.resetReactions}>
            <RefreshCw size={16} />
            Restore 0-12
          </Button>
        </div>
      </Panel>
    </div>
  );
}
