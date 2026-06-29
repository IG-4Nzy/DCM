// @ts-nocheck
export interface PhysicalServerData {
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
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
}

export interface CreatePhysicalServerPayload {
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
}

export interface UpdatePhysicalServerPayload extends Partial<CreatePhysicalServerPayload> {}
