import { csvEscape } from "../../helpers/utils";

export const TAB_CONSTANTS = {
  RACKS: "racks",
  CLUSTERS: "clusters",
  NODES: "nodes",
  VMS: "vms",
  PHYSICAL_SERVERS: "physical_servers",
  STORAGE_DEVICES: "storage_systems",
  NETWORK_DEVICES: "network_devices",
} as const;

export const SUB_TAB_MAPPING = {
  storage: TAB_CONSTANTS.STORAGE_DEVICES,
  physical: TAB_CONSTANTS.PHYSICAL_SERVERS,
  appliance: TAB_CONSTANTS.NETWORK_DEVICES,
} as const;

type Tab = (typeof TAB_CONSTANTS)[keyof typeof TAB_CONSTANTS];

interface Proptype {
  data: any[];
  tab: Tab;
}

const HeadersMap: Record<Tab, string[]> = {
  [TAB_CONSTANTS.RACKS]: [
    "Rack Name",
    "Networks",
    "Capacity",
    "Temperature",
    "Fan Available",
    "Spare Power",
    "Remarks",
  ],

  [TAB_CONSTANTS.CLUSTERS]: [
    "Cluster Name",
    "Cluster Type",
    "Network Type",
    "IP Address",
    "Nodes",
  ],

  [TAB_CONSTANTS.NODES]: [
    "Node Name",
    "IP Address",
    "Server Model",
    "Rack",
    "Rack Position",
    "Admin",
  ],

  [TAB_CONSTANTS.VMS]: ["VM Name", "Cluster", "IP Address", "Node", "Admin"],

  [TAB_CONSTANTS.PHYSICAL_SERVERS]: [
    "Node",
    "IP Address",
    "Server Model",
    "Rack",
    "Rack Position",
    "Admin",
  ],

  [TAB_CONSTANTS.STORAGE_DEVICES]: [
    "Node",
    "IP Address",
    "Server Model",
    "Rack",
    "Rack Position",
    "Admin",
  ],

  [TAB_CONSTANTS.NETWORK_DEVICES]: [
    "Device",
    "Server Model",
    "Rack",
    "Rack Position",
    "Admin",
  ],
};

const FieldsMap: Record<Tab, string[]> = {
  [TAB_CONSTANTS.RACKS]: [
    "serverRack",
    "networksAvailable",
    "rackCapacity",
    "temperature",
    "fanAvailable",
    "sparePowerAvailability",
    "remarks",
  ],

  [TAB_CONSTANTS.CLUSTERS]: [
    "clusterName",
    "clusterType",
    "networkType",
    "ipAddress",
    "nodeNames",
  ],

  [TAB_CONSTANTS.NODES]: [
    "node",
    "ip",
    "serverModel",
    "rack",
    "rackPosition",
    "admin",
  ],

  [TAB_CONSTANTS.VMS]: ["vmName", "clusterId", "ipAddress", "node", "admin"],

  [TAB_CONSTANTS.PHYSICAL_SERVERS]: [
    "physicalServerName",
    "ipAddress",
    "serverModel",
    "rack",
    "rackPosition",
    "admin",
  ],

  [TAB_CONSTANTS.STORAGE_DEVICES]: [
    "node",
    "ip",
    "serverModel",
    "rack",
    "rackPosition",
    "admin",
  ],

  [TAB_CONSTANTS.NETWORK_DEVICES]: [
    "node",
    "ip",
    "serverModel",
    "rack",
    "rackPosition",
    "admin",
  ],
};

const formatCSVValue = (value: any): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

export const generateAndDownloadCSV = async ({ data = [], tab }: Proptype) => {
  if (!tab) {
    console.error("CSV export failed: tab is undefined");
    return;
  }

  if (!Array.isArray(data)) {
    console.error("CSV export failed: data is not an array", data);
    return;
  }

  const headers = HeadersMap[tab];
  const fields = FieldsMap[tab];

  if (!headers || !fields) {
    console.error("CSV export failed: invalid tab", tab);
    return;
  }

  const rows = data.map((row) => {
    return fields
      .map((field) => {
        const value = row?.[field];
        return csvEscape(formatCSVValue(value));
      })
      .join(",");
  });

  const csv = [headers.map(csvEscape).join(","), ...rows].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  const now = new Date();

  const timestamp = now
    .toISOString()
    .replace("T", "_")
    .replace(/:/g, "-")
    .slice(0, 19);

  link.download = `${tab}-${timestamp}.csv`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};
