export interface IpListModel {
    id: string;
    _id?: string;
    ip: string;
    purpose?: string;
    takenBy?: string;
    isUsed: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface PaginatedIpListResponse {
    data: IpListModel[];
    total: number;
}
