// @ts-nocheck
export interface ADDetailsData {
    id: string;
    clusterId: string;
    ipAddress: string;
    name: string;
    hdd: string;
    ram: string;
    cpuCores: string;
    osVersion: string;
    osType: string;
    licenceExpiry: string;
}

export interface CreateADDetailsPayload {
    clusterId: string;
    ipAddress: string;
    name: string;
    hdd: string;
    ram: string;
    cpuCores: string;
    osVersion: string;
    osType: string;
    licenceExpiry: string;
}

export interface UpdateADDetailsPayload {
    ipAddress?: string;
    name?: string;
    hdd?: string;
    ram?: string;
    cpuCores?: string;
    osVersion?: string;
    osType?: string;
    licenceExpiry?: string;
}

export interface FetchADDetailsParams {
    clusterId: string;
    skip?: number;
    limit?: number;
    sortBy?: string;
    order?: 'asc' | 'desc';
    search?: string;
    pagination?: boolean;
}
