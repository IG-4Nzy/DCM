// @ts-nocheck
export interface HypervisorData {
    id: string;
    hypervisor: string;
    remarks?: string;
    createdBy?: string;
    updatedAt?: string;
}

export interface CreateHypervisorPayload {
    hypervisor: string;
    remarks?: string;
}

export interface UpdateHypervisorPayload {
    id: string;
    hypervisor?: string;
    remarks?: string;
}
