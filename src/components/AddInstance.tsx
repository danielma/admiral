import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

interface AddInstanceProps {
  onAdd: (name: string, cwd: string) => void;
  onCancel: () => void;
}

export function AddInstance({ onAdd, onCancel }: AddInstanceProps) {
  const [name, setName] = useState("");
  const [cwd, setCwd] = useState("");

  const handleBrowse = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select project directory",
    });

    if (selected && typeof selected === "string") {
      setCwd(selected);
      // Auto-fill name from directory name if empty
      if (!name) {
        const dirName = selected.split("/").pop() || "";
        setName(dirName);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && cwd.trim()) {
      onAdd(name.trim(), cwd.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="dialog-overlay" onClick={onCancel} onKeyDown={handleKeyDown}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Add Claude Instance</h2>

        <form onSubmit={handleSubmit}>
          <div className="dialog-field">
            <label className="dialog-label" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              type="text"
              className="dialog-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-project"
              autoFocus
            />
          </div>

          <div className="dialog-field">
            <label className="dialog-label" htmlFor="cwd">
              Project Directory
            </label>
            <div className="dialog-input-group">
              <input
                id="cwd"
                type="text"
                className="dialog-input"
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
                placeholder="/path/to/project"
              />
              <button
                type="button"
                className="browse-btn"
                onClick={handleBrowse}
              >
                Browse
              </button>
            </div>
          </div>

          <div className="dialog-actions">
            <button
              type="button"
              className="dialog-btn cancel"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="dialog-btn primary"
              disabled={!name.trim() || !cwd.trim()}
            >
              Add Instance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
