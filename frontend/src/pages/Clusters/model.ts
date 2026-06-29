// @ts-nocheck
export interface ClusterData {
    id: string;
    slNumber?: string;
    clusterName?: string;
    ipAddress?: string;
    racks?: string[];
    clusterType?: string;
}

export interface CreateClusterPayload {
    clusterName?: string;
    ipAddress?: string;
    racks?: string[];
    clusterType?: string;
}

export interface UpdateClusterPayload {
    clusterName?: string;
    ipAddress?: string;
    racks?: string[];
    clusterType?: string;
}

export interface FetchClustersParams {
    skip?: number;
    limit?: number;
    sortBy?: string;
    order?: 'asc' | 'desc';
    search?: string;
    pagination?: boolean;
}
