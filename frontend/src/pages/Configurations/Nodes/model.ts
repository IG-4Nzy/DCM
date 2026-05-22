export interface NodeData {
    id: string;
    node: string;
    remarks?: string;
    createdBy?: string;
    updatedAt?: string;
}

export interface CreateNodePayload {
    node: string;
    remarks?: string;
}

export interface UpdateNodePayload {
    id: string;
    node?: string;
    remarks?: string;
}
