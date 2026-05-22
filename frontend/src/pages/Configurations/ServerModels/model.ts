export interface ServerModelData {
    id: string;
    serverModel: string;
    remarks?: string;
    createdBy?: string;
    updatedAt?: string;
}

export interface CreateServerModelPayload {
    serverModel: string;
    remarks?: string;
}

export interface UpdateServerModelPayload {
    id: string;
    serverModel?: string;
    remarks?: string;
}
