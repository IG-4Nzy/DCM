// @ts-nocheck
export interface WorkData {
  id?: string;
  _id?: string;
  workId?: string;
  workName: string;
  assignee?: string;
  department?: string;
  assignees?: string[];
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
