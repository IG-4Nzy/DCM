// @ts-nocheck
export interface WorkData {
  id?: string;
  _id?: string;
  workId?: string;
  workName: string;
  assignee?: string;
  department?: string;
  assignees?: string[];
  assigneesFullName?: string;
  priority: string;
  dueDate: string;
  description: string;
  attachments: { name: string; url: string }[];
  status: string;
  comments: { text: string; user: string; timestamp: string; attachment?: { name: string; url: string } }[];
  completedAt?: string;
  createdAt?: string;
  isEmergency?: boolean;
  approved?: boolean;
  createdBy?: string;
}

export interface CreateWorkPayload {
  workName: string;
  assignee?: string;
  department?: string;
  assignees?: string[];
  priority: string;
  dueDate: string;
  description: string;
  attachments: { name: string; url: string }[];
  status?: string;
  comments?: { text: string; user: string; timestamp: string; attachment?: { name: string; url: string } }[];
  completedAt?: string;
  createdAt?: string;
  isEmergency?: boolean;
  approved?: boolean;
  createdBy?: string;
}

export interface UpdateWorkPayload extends Partial<CreateWorkPayload> {
  id: string;
}

export interface FetchWorksParams {
  skip: number;
  limit: number;
  sortBy: string;
  order: string;
  search: string;
  status?: string;
  assignee?: string;
  department?: string;
  tab?: string;
  showToast?: (msg: string, severity?: 'error' | 'success') => void;
}

export interface WorkLogEntry {
  id?: string;
  startTime: string;
  endTime: string;
  activity: string;
}

export interface WorkLogData {
  id?: string;
  _id?: string;
  date: string;
  username: string;
  userId?: string;
  userFullName?: string;
  department?: string;
  entries: WorkLogEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateWorkLogPayload {
  date: string;
  username?: string;
  entries: WorkLogEntry[];
}

export interface UpdateWorkLogPayload {
  id: string;
  date?: string;
  username?: string;
  entries?: WorkLogEntry[];
}

export interface FetchWorkLogsParams {
  skip: number;
  limit: number;
  sortBy?: string;
  order?: string;
  search?: string;
  user?: string;
  date?: string;
  showToast?: (msg: string, severity?: 'error' | 'success') => void;
}

