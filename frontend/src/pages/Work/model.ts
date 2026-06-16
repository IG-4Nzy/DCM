export interface WorkData {
  id: string;
  _id?: string;
  workName: string;
  assignee?: string;
  assignees?: string[];
  priority: string;
  dueDate: string;
  description: string;
  attachments: { name: string; url: string }[];
  status: string;
  comments: { text: string; user: string; timestamp: string }[];
  completedAt?: string;
  createdAt?: string;
}

export interface CreateWorkPayload {
  workName: string;
  assignee?: string;
  assignees?: string[];
  priority: string;
  dueDate: string;
  description: string;
  attachments: { name: string; url: string }[];
  status?: string;
  comments?: { text: string; user: string; timestamp: string }[];
  completedAt?: string;
  createdAt?: string;
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
  showToast?: (msg: string, severity?: 'error' | 'success') => void;
}
