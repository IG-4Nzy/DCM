// @ts-nocheck
export interface NodeData {
    id: string;
    nodeId?: string;
    node?: string;
    remarks?: string;
    totalRam?: number;
    totalHardisk?: number;
    totalCpu?: number;
    availableRam?: number;
    availableHardisk?: number;
    availableCpu?: number;
    rack?: string;
    rackPosition?: string;
    rackUnits?: number;
    clusterId?: string;
    serverModel?: string;
    serialNumber?: string;
    custodian?: string;
    admin?: string | string[];
    assetNumber?: string;
    raidConfiguration?: string[];
    ip?: string;
    isAppliance?: boolean;
    isStorage?: boolean;
    isPhysical?: boolean;
    os?: string;
    gpu?: string;
    createdBy?: string;
    createdAt?: string;
    updatedBy?: string;
    updatedAt?: string;
}

export interface CreateNodePayload {
    nodeId?: string;
    node?: string;
    remarks?: string;
    totalRam?: number;
    totalHardisk?: number;
    totalCpu?: number;
    rack?: string;
    rackPosition?: string;
    rackUnits?: number;
    clusterId?: string;
    serverModel?: string;
    serialNumber?: string;
    custodian?: string;
    admin?: string | string[];
    assetNumber?: string;
    raidConfiguration?: string[];
    ip?: string;
    isAppliance?: boolean;
    isStorage?: boolean;
    isPhysical?: boolean;
    os?: string;
    gpu?: string;
}

export interface UpdateNodePayload {
    id: string;
    nodeId?: string;
    node?: string;
    remarks?: string;
    totalRam?: number;
    totalHardisk?: number;
    totalCpu?: number;
    rack?: string;
    rackPosition?: string;
    rackUnits?: number;
    clusterId?: string;
    serverModel?: string;
    serialNumber?: string;
    custodian?: string;
    admin?: string | string[];
    assetNumber?: string;
    raidConfiguration?: string[];
    ip?: string;
    isAppliance?: boolean;
    isStorage?: boolean;
    isPhysical?: boolean;
    os?: string;
    gpu?: string;
}
