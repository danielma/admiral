export type InstanceStatus =
  | { status: "idle" | "working" | "error" }
  | { status: "waiting"; title: string; message?: string };

export interface Instance {
  id: string;
  name: string;
  cwd: string;
  status: InstanceStatus;
}

export interface Osc777Payload {
  type: string;
  title?: string;
  message?: string;
}
