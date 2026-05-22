export interface VCenterDetailsData {
    id: string;
    clusterId: string;
    ipAddress: string;
    name: string;
    hdd: string;
    ram: string;
    cpuCores: string;
    vcenterVersion: string;
    vcenterType: string;
    licenceExpiry: string;
    ha: string;
    drs: string;
    storage: string;
    portGroups: string;
    vmImageBackupLocation: string;
}

export interface CreateVCenterDetailsPayload {
    clusterId: string;
    ipAddress: string;
    name: string;
    hdd: string;
    ram: string;
    cpuCores: string;
    vcenterVersion: string;
    vcenterType: string;
    licenceExpiry: string;
    ha: string;
    drs: string;
    storage: string;
    portGroups: string;
    vmImageBackupLocation: string;
}

export interface UpdateVCenterDetailsPayload {
    ipAddress?: string;
    name?: string;
    hdd?: string;
    ram?: string;
    cpuCores?: string;
    vcenterVersion?: string;
    vcenterType?: string;
    licenceExpiry?: string;
    ha?: string;
    drs?: string;
    storage?: string;
    portGroups?: string;
    vmImageBackupLocation?: string;
}

export interface FetchVCenterDetailsParams {
    clusterId: string;
    skip?: number;
    limit?: number;
    sortBy?: string;
    order?: 'asc' | 'desc';
    search?: string;
    pagination?: boolean;
}
