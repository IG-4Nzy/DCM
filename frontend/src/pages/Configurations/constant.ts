import ClusterTypes from "./ClusterTypes";
import Hypervisors from "./Hypervisors";
import Nodes from "./Nodes";
import Racks from "./Racks";
import ServerModels from "./ServerModels";

export const CONFIG_TABS = [
    { id: 'serverMastersConfig', label: 'Server Masters', value: 'serverMastersConfig' },
];

export const SERVER_MASTERS_CONFIGURATIONS = [
    { id: "clusterTypes", label: "Cluster Types", value: "clusterTypes" },
    { id: "hypervisors", label: "Hypervisors", value: "hypervisors" },
    { id: "serverModel", label: "Server Model", value: "serverModel" },
    { id: "nodes", label: "Nodes", value: "nodes" },
    { id: "serverRack", label: "Server Racks", value: "serverRack" },
]

export const CONFIG_SUBTABS = {
    serverMastersConfig: SERVER_MASTERS_CONFIGURATIONS
}

export const CONFIG_TABS_PAGES = {
    clusterTypes: ClusterTypes,
    hypervisors: Hypervisors,
    serverModel: ServerModels,
    nodes: Nodes,
    serverRack: Racks,
}
