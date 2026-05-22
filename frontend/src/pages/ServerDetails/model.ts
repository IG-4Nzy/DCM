export interface ServerDetailsData {
    id: string;
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
    remarks?: string;
    createdBy?: string;
    updatedAt?: string;
}

export type CreateServerDetailsPayload = Omit<ServerDetailsData, 'id' | 'createdBy' | 'updatedAt'>;
export type UpdateServerDetailsPayload = Partial<CreateServerDetailsPayload> & { id: string };
