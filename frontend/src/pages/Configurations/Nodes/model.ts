export interface NodeData {
    id: string;
    node: string;
    remarks?: string;
    totalRam?: number;
    totalHardisk?: number;
    totalCpu?: number;
    availableRam?: number;
    availableHardisk?: number;
    availableCpu?: number;
    createdBy?: string;
    updatedAt?: string;
}

export interface CreateNodePayload {
    node: string;
    remarks?: string;
    totalRam?: number;
    totalHardisk?: number;
    totalCpu?: number;
}

export interface UpdateNodePayload {
    id: string;
    node?: string;
    remarks?: string;
    totalRam?: number;
    totalHardisk?: number;
    totalCpu?: number;
}
