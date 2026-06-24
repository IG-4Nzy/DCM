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
    totalRam?: number | string;
    totalHardisk?: number | string;
    totalCpu?: number | string;
    availableRam?: number | string;
    availableHardisk?: number | string;
    availableCpu?: number | string;
    remarks?: string;
    createdBy?: string;
    updatedAt?: string;
}

export type CreateNodeDetailsPayload = Omit<NodeDetailsData, 'id' | 'createdBy' | 'updatedAt'>;
export type UpdateNodeDetailsPayload = Partial<CreateNodeDetailsPayload> & { id: string };
