// @ts-nocheck
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Box,
  Paper,
  Tooltip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  MdAdd as AddIcon,
  MdEdit as EditIcon,
  MdDelete as DeleteIcon,
  MdMonitor as MonitorIcon,
} from "react-icons/md";
import Button from "../../../components/Button";
import SearchBar from "../../../components/SearchBar";
import Table, { type Column } from "../../../components/Table";
import { useToast } from "../../../contexts/ToastContext";
import { useConfirm } from "../../../contexts/ConfirmContext";
import { useSelector } from "react-redux";
import { type RootState } from "../../../store";
import { hasPrivilege } from "../../../helpers/authUtils";
import { PRIVILEGES } from "../../../helpers/privileges";
import { useTableState } from "../../../hooks/useTableState";
import { fetchNodes, createNode, updateNode, deleteNode } from "./action";
import { fetchClusters } from "../../Clusters/action";
import { type NodeData } from "./model";
import NodeModal from "./NodeModal";
import NodeViewModal from "./NodeViewModal";

import request from "../../../services/request";

type Order = "asc" | "desc";

const Nodes = ({ dashboardAdminFilter }: { dashboardAdminFilter?: string }) => {
  const [data, setData] = useState<NodeData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [clusters, setClusters] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [nodeAdminIds, setNodeAdminIds] = useState<Set<string>>(new Set());
  const [serverModelsList, setServerModelsList] = useState<string[]>([]);
  const [racksList, setRacksList] = useState<string[]>([]);
  const [monitoredIps, setMonitoredIps] = useState<Set<string>>(new Set());

  const fetchMonitoredIps = useCallback(async () => {
    try {
      const res = await request.get('/api/server-ping-monitoring/', { params: { limit: 1000 } });
      const ips = new Set((res.data?.data || []).map((s: any) => s.ipAddress));
      setMonitoredIps(ips);
    } catch (err) {
      console.error("Failed to load monitored IPs:", err);
    }
  }, []);

  useEffect(() => {
    fetchMonitoredIps();
  }, [fetchMonitoredIps]);

  useEffect(() => {
    fetchClusters({ pagination: false })
      .then((res) => setClusters(res.data || []))
      .catch((err) => console.error("Failed to load clusters", err));
  }, []);

  useEffect(() => {
    request
      .get("/api/users/", { params: { pagination: false } })
      .then((res) => {
        const map: Record<string, string> = {};
        const list = res.data.data || [];
        list.forEach((u: any) => {
          const fullName = [u.firstName, u.lastName]
            .filter(Boolean)
            .join(" ")
            .trim();
          const displayName = fullName || u.username;
          if (u._id) map[u._id] = displayName;
          if (u.id) map[u.id] = displayName;
          if (u.username) map[u.username] = displayName;
        });
        setUsersMap(map);
      })
      .catch((err) => console.error("Failed to load users:", err));
  }, []);

  // Fetch all nodes (lightweight) to extract unique admin IDs for the filter
  const loadNodeAdminIds = useCallback(() => {
    fetchNodes({ pagination: false })
      .then((res) => {
        const ids = new Set<string>();
        (res.data || []).forEach((n: any) => {
          const admins = Array.isArray(n.admin)
            ? n.admin
            : n.admin
              ? [n.admin]
              : [];
          admins.forEach((a: string) => ids.add(a));
        });
        setNodeAdminIds(ids);
      })
      .catch((err) => console.error("Failed to load node admin IDs:", err));
  }, []);

  useEffect(() => {
    request
      .get("/api/server-models/", { params: { pagination: false } })
      .then((res) => {
        const models = (res.data.data || [])
          .map((m: any) => m.serverModel)
          .filter(Boolean)
          .sort();
        setServerModelsList(models);
      })
      .catch((err) => console.error("Failed to load server models:", err));
  }, []);

  useEffect(() => {
    request
      .get("/api/server-racks/", { params: { pagination: false } })
      .then((res) => {
        const racks = (res.data.data || [])
          .map((r: any) => r.serverRack)
          .filter(Boolean)
          .sort();
        setRacksList(racks);
      })
      .catch((err) => console.error("Failed to load racks:", err));
  }, []);

  useEffect(() => {
    loadNodeAdminIds();
  }, [loadNodeAdminIds]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NodeData | null>(null);

  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedViewItem, setSelectedViewItem] = useState<NodeData | null>(
    null,
  );

  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const { isSuperuser } = useSelector((state: RootState) => state.auth);
  const hasCreate =
    isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
  const hasUpdate =
    isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);
  const hasDelete =
    isSuperuser || hasPrivilege(PRIVILEGES.SERVER_DETAILS_CREATE);

  const [searchQuery, setSearchQuery] = useTableState("Nodes_search", "");
  const [clusterFilter, setClusterFilter] = useTableState(
    "Nodes_clusterFilter",
    "",
  );
  const [serverModelFilter, setServerModelFilter] = useTableState(
    "Nodes_serverModelFilter",
    "",
  );
  const [adminFilter, setAdminFilter] = useTableState("Nodes_adminFilter", dashboardAdminFilter || "");
  const [rackFilter, setRackFilter] = useTableState("Nodes_rackFilter", "");
  const [page, setPage] = useTableState("Nodes_page", 0);
  const [rowsPerPage, setRowsPerPage] = useTableState("Nodes_rowsPerPage", 5);
  const [order, setOrder] = useTableState<Order>("Nodes_order", "asc");
  const [orderBy, setOrderBy] = useTableState<string>("Nodes_orderBy", "nodeId");

  // Reset page when dashboard filter changes
  useEffect(() => {
    if (dashboardAdminFilter) {
      setAdminFilter(dashboardAdminFilter);
      setPage(0);
    }
  }, [dashboardAdminFilter]);


  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchNodes({
        skip: page * rowsPerPage,
        limit: rowsPerPage,
        sortBy: orderBy,
        order,
        search: searchQuery,
        clusterId: clusterFilter || undefined,
        serverModel: serverModelFilter || undefined,
        admin: adminFilter || undefined,
        rack: rackFilter || undefined,
        pagination: true,
      });
      setData(result.data);
      setTotalCount(result.total);

      // Refresh detailed view data if open
      if (isViewOpen && selectedViewItem) {
        const updated = result.data.find((n) => n.id === selectedViewItem.id);
        if (updated) setSelectedViewItem(updated);
      }
    } catch (e: any) {
      showToast(e?.response?.data?.detail || "Failed to load nodes", "error");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    rowsPerPage,
    orderBy,
    order,
    searchQuery,
    clusterFilter,
    serverModelFilter,
    adminFilter,
    rackFilter,
    showToast,
    isViewOpen,
    selectedViewItem,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [adminFilter]);

  const handleOpenModal = (item?: NodeData) => {
    setEditingItem(item || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleRowClick = (item: NodeData) => {
    setSelectedViewItem(item);
    setIsViewOpen(true);
  };

  const handleSubmit = async (payload: any) => {
    try {
      if (editingItem) {
        await updateNode(payload);
        showToast("Node updated successfully", "success");
      } else {
        await createNode(payload);
        showToast("Node created successfully", "success");
      }
      handleCloseModal();
      loadData();
    } catch (e: any) {
      showToast(e?.response?.data?.detail || "Failed to save node", "error");
    }
  };

  const handleAddToMonitoring = async (item: NodeData) => {
    if (!item.ip) {
      showToast("This server does not have an IP address configured. Edit the node to set an IP first.", "warning");
      return;
    }
    const isConfirmed = await confirm(
      `Are you sure you want to add ${item.node || "this node"} (${item.ip}) to Ping Monitoring?`,
      "Add to Monitoring"
    );
    if (isConfirmed) {
      try {
        const adminArr = Array.isArray(item.admin) ? item.admin : [item.admin];
        const primaryAdminId = adminArr[0] || "";
        const adminDisplayName = usersMap[primaryAdminId] || "";

        await request.post('/api/server-ping-monitoring/', {
          name: item.node || "Unnamed Node",
          ipAddress: item.ip,
          adminName: adminDisplayName || "Admin",
          monitoringType: "ping",
          interval: 60,
          timeout: 5,
          retryCount: 3,
          ports: [],
          isEnabled: true
        });
        setMonitoredIps(prev => {
          const next = new Set(prev);
          next.add(item.ip);
          return next;
        });
        showToast("Node added to ping monitoring successfully", "success");
      } catch (e: any) {
        showToast(
          e?.response?.data?.detail || "Failed to add node to monitoring",
          "error"
        );
      }
    }
  };

  const handleDelete = async (item: NodeData) => {
    const isConfirmed = await confirm(
      `Are you sure you want to delete ${item.node}?`,
      "Delete Node",
    );
    if (isConfirmed) {
      try {
        await deleteNode(item.id);
        showToast("Node deleted successfully", "success");
        if (data.length === 1 && page > 0) {
          setPage(page - 1);
        } else {
          loadData();
        }
      } catch (e: any) {
        showToast(
          e?.response?.data?.detail || "Failed to delete node",
          "error",
        );
      }
    }
  };

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getClusterName = (cid?: string) => {
    if (!cid) return "-";
    const found = clusters.find((c) => c.id === cid);
    return found ? found.clusterName : cid;
  };

  const columns: Column<NodeData>[] = [
    {
      id: "nodeId",
      label: "Node ID",
      sortable: true,
      render: (row) => (
        <span style={{ fontWeight: 600, color: "#1565c0" }}>
          {row.nodeId || "--"}
        </span>
      ),
    },
    {
      id: "clusterId",
      label: "Cluster",
      sortable: true,
      render: (row) => getClusterName(row.clusterId || ""),
    },
    { id: "node", label: "Node", sortable: true },
    {
      id: "ip",
      label: "IP Address",
      sortable: true,
      render: (row) => row.ip || "-",
    },
    {
      id: "serverModel",
      label: "Server Model",
      sortable: true,
      render: (row) => row.serverModel || "-",
    },
    {
      id: "serialNumber",
      label: "Serial Number",
      sortable: true,
      render: (row) => row.serialNumber || "-",
    },
    {
      id: "assetNumber",
      label: "Asset Number",
      sortable: true,
      render: (row) => row.assetNumber || "-",
    },
    {
      id: "custodian",
      label: "Custodian",
      sortable: true,
      render: (row) => row.custodian || "-",
    },
    {
      id: "admin",
      label: "Admin",
      sortable: true,
      render: (row) => {
        if (!row.admin) return "-";
        const adminArr = Array.isArray(row.admin) ? row.admin : [row.admin];
        return adminArr.map((a) => usersMap[a] || a).join(", ") || "-";
      },
    },
    {
      id: "totalRam",
      label: "Total RAM",
      sortable: true,
      render: (row) =>
        row.totalRam !== undefined && row.totalRam !== null
          ? row.totalRam
          : "-",
    },
    {
      id: "totalHardisk",
      label: "Total HDD",
      sortable: true,
      render: (row) =>
        row.totalHardisk !== undefined && row.totalHardisk !== null
          ? row.totalHardisk
          : "-",
    },
    {
      id: "totalCpu",
      label: "Total CPU",
      sortable: true,
      render: (row) =>
        row.totalCpu !== undefined && row.totalCpu !== null
          ? row.totalCpu
          : "-",
    },
    {
      id: "rack",
      label: "Rack",
      sortable: true,
      render: (row) => row.rack || "-",
    },
    {
      id: "rackPosition",
      label: "Position",
      sortable: true,
      render: (row) => row.rackPosition || "-",
    },
    {
      id: "rackUnits",
      label: "Units",
      sortable: true,
      render: (row) =>
        row.rackUnits !== undefined && row.rackUnits !== null
          ? `${row.rackUnits} U`
          : "-",
    },
    { id: "remarks", label: "Remarks", sortable: false },
  ];

  if (hasUpdate || hasDelete) {
    columns.push({
      id: "id",
      label: "Actions",
      align: "right",
      sortable: false,
      render: (row) => {
        const isMonitored = row.ip ? monitoredIps.has(row.ip) : false;
        return (
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            {isMonitored ? (
              <Tooltip title="Already Monitored">
                <span>
                  <IconButton
                    size="small"
                    disabled
                    sx={{ color: '#2e7d32', backgroundColor: 'rgba(46, 125, 50, 0.08)', '&.Mui-disabled': { color: '#2e7d32' } }}
                  >
                    <MonitorIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : (
              <Tooltip title="Add to Monitoring">
                <IconButton
                  size="small"
                  color="info"
                  sx={{ backgroundColor: "rgba(2, 136, 209, 0.04)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToMonitoring(row);
                  }}
                >
                  <MonitorIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          {hasUpdate && (
            <Tooltip title="Edit">
              <IconButton
                size="small"
                color="primary"
                sx={{ backgroundColor: "rgba(25, 118, 210, 0.04)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenModal(row);
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {hasDelete && (
            <Tooltip title="Delete">
              <IconButton
                size="small"
                color="error"
                sx={{ backgroundColor: "rgba(211, 47, 47, 0.04)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(row);
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        );
      },
    });
  }

  const filterSelectSx = {
    minWidth: 160,
    bgcolor: "white",
    "& .MuiOutlinedInput-root": { borderRadius: "8px" },
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box sx={{ flexGrow: 1 }} />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <FormControl size="small" sx={filterSelectSx}>
            <InputLabel>Cluster</InputLabel>
            <Select
              value={clusterFilter}
              label="Cluster"
              onChange={(e) => {
                setClusterFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="">All Clusters</MenuItem>
              {clusters.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.clusterName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={filterSelectSx}>
            <InputLabel>Server Model</InputLabel>
            <Select
              value={serverModelFilter}
              label="Server Model"
              onChange={(e) => {
                setServerModelFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="">All Models</MenuItem>
              {serverModelsList.map((m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={filterSelectSx}>
            <InputLabel>Admin</InputLabel>
            <Select
              value={adminFilter}
              label="Admin"
              onChange={(e) => {
                setAdminFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="">All Admins</MenuItem>
              {Array.from(nodeAdminIds)
                .sort((a, b) =>
                  (usersMap[a] || a).localeCompare(usersMap[b] || b),
                )
                .map((adminId) => (
                  <MenuItem key={adminId} value={adminId}>
                    {usersMap[adminId] || adminId}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={filterSelectSx}>
            <InputLabel>Rack</InputLabel>
            <Select
              value={rackFilter}
              label="Rack"
              onChange={(e) => {
                setRackFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="">All Racks</MenuItem>
              {racksList.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search nodes..."
          />
          {hasCreate && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => handleOpenModal()}
            >
              Add Node
            </Button>
          )}
        </Box>
      </Box>

      <Paper
        sx={{
          width: "100%",
          mb: 2,
          p: 0,
          boxShadow: "none",
          background: "transparent",
        }}
      >
        <Table
          columns={columns}
          data={data}
          totalCount={totalCount}
          page={page}
          rowsPerPage={rowsPerPage}
          orderBy={orderBy}
          order={order}
          onSort={handleRequestSort}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          loading={loading}
          onRowClick={handleRowClick}
        />
      </Paper>

      <NodeModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        editingItem={editingItem}
      />

      <NodeViewModal
        open={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        node={selectedViewItem}
        adminName={
          selectedViewItem
            ? Array.isArray(selectedViewItem.admin)
              ? selectedViewItem.admin
                  .map((a: string) => usersMap[a] || a)
                  .join(", ")
              : usersMap[selectedViewItem.admin] || selectedViewItem.admin
            : undefined
        }
      />
    </Box>
  );
};

export default Nodes;
