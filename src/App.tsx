import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { Sidebar } from "./components/Sidebar";
import { Terminal } from "./components/Terminal";
import { AddInstance } from "./components/AddInstance";
import { Instance, InstanceStatus } from "./types";

function App() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(false);
  const terminalsRef = useRef<Map<string, boolean>>(new Map());

  // Load saved instances on mount
  useEffect(() => {
    const loadInstances = async () => {
      try {
        const saved = await invoke<Instance[]>("load_instances");
        // Reset status to idle on load (we'll respawn terminals)
        const withIdleStatus = saved.map((i) => ({ ...i, status: "idle" as InstanceStatus }));
        setInstances(withIdleStatus);
        if (withIdleStatus.length > 0) {
          setActiveId(withIdleStatus[0].id);
        }
      } catch (e) {
        console.error("Failed to load instances:", e);
      }
    };
    loadInstances();
  }, []);

  // Request notification permission
  useEffect(() => {
    const setupNotifications = async () => {
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === "granted";
      }
      setNotificationPermission(granted);
    };
    setupNotifications();
  }, []);

  // Save instances when they change
  useEffect(() => {
    const saveInstances = async () => {
      if (instances.length > 0) {
        try {
          await invoke("save_instances", { instances });
        } catch (e) {
          console.error("Failed to save instances:", e);
        }
      }
    };
    saveInstances();
  }, [instances]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "n") {
          e.preventDefault();
          setShowAddDialog(true);
        } else if (e.key >= "1" && e.key <= "9") {
          e.preventDefault();
          const index = parseInt(e.key) - 1;
          if (index < instances.length) {
            setActiveId(instances[index].id);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [instances]);

  const handleStatusChange = useCallback(
    (instanceId: string, status: InstanceStatus) => {
      setInstances((prev) =>
        prev.map((i) => (i.id === instanceId ? { ...i, status } : i))
      );

      // Send notification when an instance needs attention
      if (status === "waiting" && notificationPermission) {
        const instance = instances.find((i) => i.id === instanceId);
        if (instance) {
          sendNotification({
            title: "Claude needs attention",
            body: `${instance.name} is waiting for input`,
          });
        }
      }
    },
    [instances, notificationPermission]
  );

  const handleAddInstance = async (name: string, cwd: string) => {
    const id = crypto.randomUUID();
    const newInstance: Instance = {
      id,
      name,
      cwd,
      status: "idle",
    };

    setInstances((prev) => [...prev, newInstance]);
    setActiveId(id);
    setShowAddDialog(false);

    // Spawn terminal with claude command
    try {
      await invoke("spawn_terminal", {
        id,
        cwd,
        command: ["claude"],
      });
      handleStatusChange(id, "working");
      terminalsRef.current.set(id, true);
    } catch (e) {
      console.error("Failed to spawn terminal:", e);
      handleStatusChange(id, "error");
    }
  };

  const handleRemoveInstance = async (instanceId: string) => {
    try {
      await invoke("kill_terminal", { id: instanceId });
    } catch {
      // Terminal might already be dead
    }

    setInstances((prev) => prev.filter((i) => i.id !== instanceId));
    terminalsRef.current.delete(instanceId);

    if (activeId === instanceId) {
      const remaining = instances.filter((i) => i.id !== instanceId);
      setActiveId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleTerminalExit = useCallback(
    (instanceId: string) => {
      handleStatusChange(instanceId, "idle");
      terminalsRef.current.delete(instanceId);
    },
    [handleStatusChange]
  );

  // Spawn terminals for loaded instances
  useEffect(() => {
    const spawnTerminals = async () => {
      for (const instance of instances) {
        if (!terminalsRef.current.has(instance.id)) {
          try {
            await invoke("spawn_terminal", {
              id: instance.id,
              cwd: instance.cwd,
              command: ["claude"],
            });
            terminalsRef.current.set(instance.id, true);
            handleStatusChange(instance.id, "working");
          } catch (e) {
            console.error(`Failed to spawn terminal for ${instance.name}:`, e);
            handleStatusChange(instance.id, "error");
          }
        }
      }
    };

    if (instances.length > 0) {
      spawnTerminals();
    }
  }, [instances.length]); // Only run when instance count changes

  const activeInstance = instances.find((i) => i.id === activeId);

  return (
    <div className="app-container">
      <Sidebar
        instances={instances}
        activeId={activeId}
        onSelect={setActiveId}
        onAddClick={() => setShowAddDialog(true)}
      />

      <main className="terminal-area">
        {activeInstance ? (
          <>
            <header className="terminal-header">
              <span className="terminal-title">
                {activeInstance.name} — {activeInstance.cwd}
              </span>
              <div className="terminal-actions">
                <button
                  className="terminal-action-btn danger"
                  onClick={() => handleRemoveInstance(activeInstance.id)}
                  title="Close this instance"
                >
                  Close
                </button>
              </div>
            </header>
            <div className="terminal-container">
              {instances.map((instance) => (
                <Terminal
                  key={instance.id}
                  instanceId={instance.id}
                  isActive={instance.id === activeId}
                  onStatusChange={(status) =>
                    handleStatusChange(instance.id, status)
                  }
                  onExit={() => handleTerminalExit(instance.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-text">No Claude instances</div>
            <div className="empty-state-hint">
              Press <kbd>Cmd+N</kbd> or click "Add Instance" to get started
            </div>
          </div>
        )}
      </main>

      {showAddDialog && (
        <AddInstance
          onAdd={handleAddInstance}
          onCancel={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
}

export default App;
