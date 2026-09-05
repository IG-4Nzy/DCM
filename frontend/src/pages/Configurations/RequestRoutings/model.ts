// @ts-nocheck
export interface RequestRoutingStage {
  stageName: string;
  order: number;
  assignmentType?: string;
  assignedTo?: string | string[];
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
  conditionalAssignments?: Array<{
    conditionField: string;
    conditionValue: string;
    assignmentType?: string;
    assignedTo?: string | string[];
  }>;
  attachmentUrl?: string;
  attachmentName?: string;
  requireTermsAgreement?: boolean;
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
