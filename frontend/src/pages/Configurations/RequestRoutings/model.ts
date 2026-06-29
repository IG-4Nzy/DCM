// @ts-nocheck
export interface RequestRoutingStage {
  stageName: string;
  order: number;
  assignmentType?: string;
  assignedTo?: string;
}

export interface RequestRoutingData {
  id?: string;
  _id?: string;
  requestType: string;
  stages: RequestRoutingStage[];
}

export interface CreateRequestRoutingPayload {
  requestType: string;
  stages: RequestRoutingStage[];
}

export interface UpdateRequestRoutingPayload {
  id: string;
  requestType?: string;
  stages?: RequestRoutingStage[];
}
