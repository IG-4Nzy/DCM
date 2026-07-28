// @ts-nocheck
export interface VMDetailsData {
    id: string;
    vmId?: string;
    vmName?: string;
    clusterId?: string;
    ipAddress?: string;
    applications?: string;
    node?: string;
    osAndExpiry?: string;
    hdd?: string;
    ram?: string;
    cpu?: string;
    backupName?: string;
    backupNode?: string;
    backupStorage?: string;
    datastore?: string;
    addedToMonitoring?: boolean;
    adminName?: string;
    adminContact?: string;
    admin?: string | string[];
    powerStatus?: string;
    createdAt?: string;
    updatedBy?: string;
    updatedAt?: string;
    createdBy?: string;
}

export interface CreateVMDetailsPayload {
    vmId?: string;
    vmName?: string;
    clusterId?: string;
    ipAddress?: string;
    applications?: string;
    node?: string;
    osAndExpiry?: string;
    hdd?: string;
    ram?: string;
    cpu?: string;
    backupName?: string;
    backupNode?: string;
    backupStorage?: string;
    datastore?: string;
    addedToMonitoring?: boolean;
    adminName?: string;
    adminContact?: string;
    admin?: string | string[];
    powerStatus?: string;
}

export interface UpdateVMDetailsPayload extends Partial<CreateVMDetailsPayload> {}
