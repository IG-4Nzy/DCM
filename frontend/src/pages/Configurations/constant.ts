import ClusterTypes from "./ClusterTypes";
import Hypervisors from "./Hypervisors";
import Nodes from "./Nodes";
import Racks from "./Racks";
import ServerModels from "./ServerModels";
import RequestRoutings from "./RequestRoutings";

export const CONFIG_TABS = [
    { id: 'serverMastersConfig', label: 'Server Masters', value: 'serverMastersConfig' },
    { id: 'requestConfig', label: 'Request Configuration', value: 'requestConfig' },
];

export const SERVER_MASTERS_CONFIGURATIONS = [
    { id: "clusterTypes", label: "Cluster Types", value: "clusterTypes" },
    { id: "hypervisors", label: "Hypervisors", value: "hypervisors" },
    { id: "serverModel", label: "Server Model", value: "serverModel" },
    { id: "nodes", label: "Nodes", value: "nodes" },
    { id: "serverRack", label: "Server Racks", value: "serverRack" },
]

export const REQUEST_CONFIGURATIONS = [
    { id: "requestRoutings", label: "Request Routings", value: "requestRoutings" },
]

export const CONFIG_SUBTABS = {
    serverMastersConfig: SERVER_MASTERS_CONFIGURATIONS,
    requestConfig: REQUEST_CONFIGURATIONS,
}

export const CONFIG_TABS_PAGES = {
    clusterTypes: ClusterTypes,
    hypervisors: Hypervisors,
    serverModel: ServerModels,
    nodes: Nodes,
    serverRack: Racks,
    requestRoutings: RequestRoutings,
}
