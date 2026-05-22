export interface VMDetailsData {
    id: string;
    clusterId: string;
    ipAddress: string;
    applications: string;
    node: string;
    osAndExpiry: string;
    hdd: string;
    ram: string;
    cpu: string;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
}

export interface CreateVMDetailsPayload {
    clusterId: string;
    ipAddress: string;
    applications: string;
    node: string;
    osAndExpiry: string;
    hdd: string;
    ram: string;
    cpu: string;
}

export interface UpdateVMDetailsPayload extends Partial<CreateVMDetailsPayload> {}
