export interface ServerRackData {
    id: string;
    serverRack: string;
    remarks?: string;
    createdBy?: string;
    updatedAt?: string;
}

export interface CreateServerRackPayload {
    serverRack: string;
    remarks?: string;
}

export interface UpdateServerRackPayload {
    id: string;
    serverRack?: string;
    remarks?: string;
}
