import { Copy, GripVertical, Trash2 } from "lucide-react";
import { useState } from "react";

export function ReactionRail({
  reactions,
  currentReactionId,
  onSelect,
  onReorder,
  onDuplicate,
  onRemove,
  compact = false,
}) {
  const [draggedId, setDraggedId] = useState(null);

  const moveReaction = (sourceId, targetId) => {
    if (!sourceId || sourceId === targetId) {
      return;
    }

    const sourceIndex = reactions.findIndex((reaction) => reaction.id === sourceId);
    const targetIndex = reactions.findIndex((reaction) => reaction.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const next = [...reactions];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    onReorder(next);
  };

  const moveByStep = (reactionId, direction) => {
    const index = reactions.findIndex((reaction) => reaction.id === reactionId);
    const target = index + direction;
    if (target < 0 || target >= reactions.length) {
      return;
    }
    const next = [...reactions];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onReorder(next);
  };

  return (
    <div className={`reaction-rail ${compact ? "reaction-rail-compact" : ""}`}>
      {reactions.map((reaction) => (
        <article
          key={reaction.id}
          draggable
          onDragStart={() => setDraggedId(reaction.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => moveReaction(draggedId, reaction.id)}
          onDragEnd={() => setDraggedId(null)}
          className={`reaction-chip ${currentReactionId === reaction.id ? "reaction-chip-active" : ""}`}
        >
          <button className="drag-handle" type="button" aria-label={`Drag ${reaction.name}`}>
            <GripVertical size={16} />
          </button>
          <button className="reaction-main" type="button" onClick={() => onSelect(reaction)}>
            <span className="reaction-code">{reaction.code}</span>
            <span>
              <span className="reaction-name">{reaction.name}</span>
              <span className="reaction-meta">{reaction.mood}</span>
            </span>
          </button>
          <span className="reaction-swatch" style={{ backgroundColor: reaction.color }} />
          {onDuplicate && (
            <button
              className="reaction-delete"
              type="button"
              aria-label={`Duplicate ${reaction.name}`}
              onClick={() => onDuplicate(reaction.id)}
            >
              <Copy size={15} />
            </button>
          )}
          <div className="reaction-mobile-order">
            <button type="button" onClick={() => moveByStep(reaction.id, -1)} aria-label="Move up">
              Up
            </button>
            <button type="button" onClick={() => moveByStep(reaction.id, 1)} aria-label="Move down">
              Down
            </button>
          </div>
          {onRemove && (
            <button
              className="reaction-delete"
              type="button"
              aria-label={`Remove ${reaction.name}`}
              onClick={() => onRemove(reaction.id)}
            >
              <Trash2 size={15} />
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
