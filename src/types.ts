export type InstanceStatus = "idle" | "working" | "waiting" | "error";

export interface Instance {
  id: string;
  name: string;
  cwd: string;
  status: InstanceStatus;
}

export interface NotificationRequest {
  title: string;
  message?: string;
}

export interface Osc777Payload {
  type: string;
  title?: string;
  message?: string;
}
