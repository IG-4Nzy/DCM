// @ts-nocheck
export interface ClusterTypeData {
    id: string;
    clusterType: string;
    remarks?: string;
    createdBy?: string;
    updatedAt?: string;
}

export interface CreateClusterTypePayload {
    clusterType: string;
    remarks?: string;
}

export interface UpdateClusterTypePayload {
    id: string;
    clusterType?: string;
    remarks?: string;
}
