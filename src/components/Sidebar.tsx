import { Instance } from "../types";

interface SidebarProps {
  instances: Instance[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAddClick: () => void;
}

export function Sidebar({
  instances,
  activeId,
  onSelect,
  onAddClick,
}: SidebarProps) {
  const getShortPath = (cwd: string): string => {
    const home = "~";
    const parts = cwd.split("/");
    if (parts.length <= 3) {
      return cwd.replace(/^\/Users\/[^/]+/, home);
    }
    return home + "/.../" + parts.slice(-2).join("/");
  };

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h1>Multi-Claude</h1>
      </header>

      <div className="sidebar-content">
        <div className="instance-list">
          {instances.map((instance, index) => (
            <button
              key={instance.id}
              className={`instance-item ${activeId === instance.id ? "active" : ""}`}
              onClick={() => onSelect(instance.id)}
              title={`${instance.cwd}\nCmd+${index + 1} to switch`}
            >
              <span className={`status-indicator ${instance.status.status}`} />
              <div className="instance-info">
                <div className="instance-name">{instance.name}</div>
                <div className="instance-path">
                  {getShortPath(instance.cwd)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <footer className="sidebar-footer">
        <button className="add-instance-btn" onClick={onAddClick}>
          <span>+</span>
          <span>Add Instance</span>
        </button>
      </footer>

      <div className="keyboard-hint">
        <kbd>Cmd+N</kbd> new &nbsp; <kbd>Cmd+1-9</kbd> switch
      </div>
    </aside>
  );
}
