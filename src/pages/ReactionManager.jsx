import { Download, FileUp, Plus, Save, Search, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button, Panel, TextField } from "../components/Controls.jsx";
import { ReactionForm } from "../components/Editors.jsx";
import { ReactionRail } from "../components/ReactionRail.jsx";
import { RobotFaceCanvas } from "../components/RobotFaceCanvas.jsx";

const exportTemplates = (state) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    schema: "roboface.v1",
    faces: state.faces,
    reactions: state.reactions,
    devices: state.devices,
    settings: state.settings,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "roboface-templates.json";
  link.click();
  URL.revokeObjectURL(url);
};

export function ReactionManager({ state }) {
  const { actions } = state;
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(state.currentReaction.id);
  const [templateName, setTemplateName] = useState("Reaction Pack");

  const filteredReactions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return state.orderedReactions;
    }

    return state.orderedReactions.filter((reaction) =>
      [reaction.name, reaction.reaction, reaction.mood, reaction.animation, reaction.customText]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, state.orderedReactions]);

  const editingReaction = state.reactions[editingId] || filteredReactions[0] || state.currentReaction;

  const handleImport = (file) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        actions.importTemplate(JSON.parse(reader.result));
      } catch {
        window.alert("Template import failed. Check that the JSON file is valid.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="manager-layout">
      <Panel
        title="Reaction Library"
        action={
          <Button variant="secondary" onClick={actions.addReaction}>
            <Plus size={16} />
            Add
          </Button>
        }
      >
        <div className="stack">
          <label className="search-box">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reactions"
              type="search"
            />
          </label>
          <ReactionRail
            reactions={filteredReactions}
            currentReactionId={editingReaction.id}
            onSelect={(reaction) => {
              setEditingId(reaction.id);
              actions.selectReaction(reaction);
            }}
            onReorder={actions.reorderReactions}
            onDuplicate={actions.duplicateReaction}
            onRemove={(reactionId) => {
              actions.removeReaction(reactionId);
              if (editingId === reactionId) {
                setEditingId(state.orderedReactions.find((reaction) => reaction.id !== reactionId)?.id || "normal");
              }
            }}
            compact
          />
        </div>
      </Panel>

      <Panel className="manager-editor" title="Template Editor">
        <div className="manager-preview-row">
          <RobotFaceCanvas reaction={editingReaction} settings={state.settings} />
          <div className="reaction-readout">
            <span className="reaction-code large">{editingReaction.code}</span>
            <h2>{editingReaction.name}</h2>
            <p>{editingReaction.reaction} / {editingReaction.animation}</p>
            <Button variant="primary" onClick={() => actions.selectReaction(editingReaction)}>
              Save to Device
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
      </Panel>

      <Panel className="wide-panel" title="Import / Export">
        <div className="toolbar-row">
          <TextField label="Template Name" value={templateName} onChange={setTemplateName} />
          <Button
            variant="primary"
            onClick={() => actions.saveFaceTemplate(templateName, state.orderedReactions.map((reaction) => reaction.id))}
          >
            <Save size={16} />
            Save Template
          </Button>
          <Button variant="secondary" onClick={() => exportTemplates(state)}>
            <Download size={16} />
            Export
          </Button>
          <Button variant="ghost" onClick={() => inputRef.current?.click()}>
            <FileUp size={16} />
            Import
          </Button>
          <Button variant="ghost" onClick={actions.resetReactions}>
            <Trash2 size={16} />
            Restore Defaults
          </Button>
          <input
            ref={inputRef}
            className="hidden"
            accept="application/json"
            type="file"
            onChange={(event) => handleImport(event.target.files?.[0])}
          />
        </div>
      </Panel>
    </div>
  );
}
