export interface NodeDetailsData {
    id: string;
    clusterId: string;
    slNumber: string;
    rack: string;
    hostName: string;
    ipAddress: string;
    serverModel: string;
    serialNumber: string;
    admin: string;
    adminCode: string;
    hypervisor: string;
    applications: string;
    clusterType: string;
    indentor: string;
    poNum: string;
    assetNum: string;
    custodian: string;
    redundancyPower: string;
    totalRam?: number;
    totalHardisk?: number;
    totalCpu?: number;
    availableRam?: number;
    availableHardisk?: number;
    availableCpu?: number;
    remarks?: string;
    createdBy?: string;
    updatedAt?: string;
}

export type CreateNodeDetailsPayload = Omit<NodeDetailsData, 'id' | 'createdBy' | 'updatedAt'>;
export type UpdateNodeDetailsPayload = Partial<CreateNodeDetailsPayload> & { id: string };
