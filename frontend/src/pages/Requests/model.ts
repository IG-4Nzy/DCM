// @ts-nocheck
export interface RequestData {
  id?: string;
  _id?: string;
  requestType?: string;
  category?: string;
  description?: string;
  details?: any;
  status: string;
  remarks?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  currentStageIndex?: number;
  currentAssignedUsers?: string[];
  // Legacy fields
  name?: string;
  division?: string;
  purpose?: string;
  ram?: string;
  hardDisk?: string;
  cpu?: string;
  ip?: string;
  osVersion?: string;
}

export interface FetchRequestsResponse {
  data: RequestData[];
  total: number;
}

export interface VisitorLogData {
  _id?: string;
  requestId: string;
  visitorName: string;
  division: string;
  purpose: string;
  entryTime: string;
  exitTime: string;
  loggedBy: string;
  createdAt: string;
  itemsToBring?: string;
  keptItemsOnExit?: boolean;
}

export interface RequestLogData {
  _id?: string;
  requestId: string;
  action: string;
  details: string;
  user: string;
  remarks: string;
  timestamp: string;
}
