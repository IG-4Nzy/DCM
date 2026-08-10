// @ts-nocheck
export interface GPUData {
    id: string;
    gpuName: string;
    remarks?: string;
    createdBy?: string;
    createdAt?: string;
    updatedBy?: string;
    updatedAt?: string;
}

export interface CreateGPUPayload {
    gpuName: string;
    remarks?: string;
}

export interface UpdateGPUPayload {
    id: string;
    gpuName?: string;
    remarks?: string;
}
