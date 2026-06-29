// @ts-nocheck
export interface ServerRackData {
    id: string;
    serverRack?: string;
    networksAvailable?: string[];
    rackCapacity?: number | null;
    remainingCapacity?: number;
    temperature?: number | null;
    fanAvailable?: boolean;
    sparePowerAvailability?: boolean;
    sparePowerC30?: string;
    sparePowerC90?: string;
    remarks?: string;
    createdBy?: string;
    updatedAt?: string;
}

export interface CreateServerRackPayload {
    serverRack?: string;
    networksAvailable?: string[];
    rackCapacity?: number | null;
    temperature?: number | null;
    fanAvailable?: boolean;
    sparePowerAvailability?: boolean;
    sparePowerC30?: string;
    sparePowerC90?: string;
    remarks?: string;
}

export interface UpdateServerRackPayload {
    id: string;
    serverRack?: string;
    networksAvailable?: string[];
    rackCapacity?: number | null;
    temperature?: number | null;
    fanAvailable?: boolean;
    sparePowerAvailability?: boolean;
    sparePowerC30?: string;
    sparePowerC90?: string;
    remarks?: string;
}
