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
