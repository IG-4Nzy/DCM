// @ts-nocheck
export interface VMDetailsData {
    id: string;
    clusterId?: string;
    ipAddress?: string;
    applications?: string;
    node?: string;
    osAndExpiry?: string;
    hdd?: string;
    ram?: string;
    cpu?: string;
    backupLocation?: string;
    addedToMonitoring?: boolean;
    adminName?: string;
    adminContact?: string;
    admin?: string;
    powerStatus?: string;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
}

export interface CreateVMDetailsPayload {
    clusterId?: string;
    ipAddress?: string;
    applications?: string;
    node?: string;
    osAndExpiry?: string;
    hdd?: string;
    ram?: string;
    cpu?: string;
    backupLocation?: string;
    addedToMonitoring?: boolean;
    adminName?: string;
    adminContact?: string;
    admin?: string;
    powerStatus?: string;
}

export interface UpdateVMDetailsPayload extends Partial<CreateVMDetailsPayload> {}
