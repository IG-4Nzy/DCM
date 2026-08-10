// @ts-nocheck
export interface DatastoreData {
    id?: string;
    _id?: string;
    name: string;
    type: string;
    capacity: string;
    createdBy?: string;
    createdAt?: string;
    updatedBy?: string;
    updatedAt?: string;
}

export interface CreateDatastorePayload {
    name: string;
    type: string;
    capacity: string;
}

export interface UpdateDatastorePayload extends Partial<CreateDatastorePayload> {}
