// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  TextField, 
  InputAdornment, 
  Typography, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Chip, 
  Grid, 
  Divider, 
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import { 
  MdSearch as SearchIcon, 
  MdDns as NodeIcon, 
  MdComputer as VmIcon,
  MdMemory as RamIcon,
  MdStorage as HddIcon,
  MdSpeed as CpuIcon,
  MdLayers as ClusterIcon,
  MdOutlineFeaturedPlayList as AppIcon,
  MdOutlineCalendarToday as DateIcon,
  MdPerson as PersonIcon,
  MdBookmarkBorder as TagIcon,
  MdInfoOutline as InfoIcon
} from 'react-icons/md';
import request from '../../services/request';

interface SearchResultItem {
  type: 'node' | 'vm' | 'cluster' | 'rack' | 'physical_server' | 'inventory';
  id: string;
  clusterName: string;
  name: string;
  subtitle: string;
  data: any;
}

const getItemIcon = (type: string) => {
  switch (type) {
    case 'node':
      return <NodeIcon style={{ color: '#1976d2', fontSize: '1.5rem' }} />;
    case 'vm':
      return <VmIcon style={{ color: '#2e7d32', fontSize: '1.5rem' }} />;
    case 'cluster':
      return <ClusterIcon style={{ color: '#ed6c02', fontSize: '1.5rem' }} />;
    case 'rack':
      return <HddIcon style={{ color: '#9c27b0', fontSize: '1.5rem' }} />;
    case 'physical_server':
      return <NodeIcon style={{ color: '#0288d1', fontSize: '1.5rem' }} />;
    case 'inventory':
      return <TagIcon style={{ color: '#e91e63', fontSize: '1.5rem' }} />;
    default:
      return <InfoIcon style={{ color: '#757575', fontSize: '1.5rem' }} />;
  }
};

const getDetailedIcon = (type: string) => {
  switch (type) {
    case 'node':
      return <NodeIcon style={{ fontSize: '2.5rem', color: '#1976d2' }} />;
    case 'vm':
      return <VmIcon style={{ fontSize: '2.5rem', color: '#2e7d32' }} />;
    case 'cluster':
      return <ClusterIcon style={{ fontSize: '2.5rem', color: '#ed6c02' }} />;
    case 'rack':
      return <HddIcon style={{ fontSize: '2.5rem', color: '#9c27b0' }} />;
    case 'physical_server':
      return <NodeIcon style={{ fontSize: '2.5rem', color: '#0288d1' }} />;
    case 'inventory':
      return <TagIcon style={{ fontSize: '2.5rem', color: '#e91e63' }} />;
    default:
      return <InfoIcon style={{ fontSize: '2.5rem', color: '#757575' }} />;
  }
};

const getChipColor = (type: string): "primary" | "success" | "warning" | "secondary" | "info" | "error" | "default" => {
  switch (type) {
    case 'node': return 'primary';
    case 'vm': return 'success';
    case 'cluster': return 'warning';
    case 'rack': return 'secondary';
    case 'physical_server': return 'info';
    case 'inventory': return 'error';
    default: return 'default';
  }
};

const getChipLabel = (type: string) => {
  switch (type) {
    case 'node': return 'Node';
    case 'vm': return 'VM';
    case 'cluster': return 'Cluster';
    case 'rack': return 'Rack';
    case 'physical_server': return 'Physical Server';
    case 'inventory': return 'Inventory';
    default: return type;
  }
};

const Search: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'node' | 'vm' | 'cluster' | 'rack' | 'physical_server' | 'inventory'>('all');
  
  const [nodes, setNodes] = useState<any[]>([]);
  const [vms, setVms] = useState<any[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [searchedClusters, setSearchedClusters] = useState<any[]>([]);
  const [racks, setRacks] = useState<any[]>([]);
  const [physicalServers, setPhysicalServers] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null);

  // Debounce the search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300); // 300ms debounce
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load all clusters for name mapping
  useEffect(() => {
    const loadClusters = async () => {
      try {
        const response = await request.get('/api/clusters/', { params: { pagination: false } });
        setClusters(response.data.data || []);
      } catch (err) {
        console.error('Failed to load clusters:', err);
      }
    };
    loadClusters();
  }, []);

  // Fetch all entity types based on debounced search query
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim()) {
        setNodes([]);
        setVms([]);
        setSearchedClusters([]);
        setRacks([]);
        setPhysicalServers([]);
        setInventoryItems([]);
        setSelectedItem(null);
        return;
      }

      setLoading(true);
      try {
        const results = await Promise.allSettled([
          request.get('/api/node-details', { params: { pagination: false, search: debouncedQuery } }),
          request.get('/api/vm-details', { params: { pagination: false, search: debouncedQuery } }),
          request.get('/api/clusters/', { params: { pagination: false, search: debouncedQuery } }),
          request.get('/api/server-racks/', { params: { pagination: false, search: debouncedQuery } }),
          request.get('/api/physical-servers/', { params: { pagination: false, search: debouncedQuery } }),
          request.get('/api/inventory/', { params: { pagination: false, search: debouncedQuery } }),
        ]);

        setNodes(results[0].status === 'fulfilled' ? results[0].value.data.data || [] : []);
        setVms(results[1].status === 'fulfilled' ? results[1].value.data.data || [] : []);
        setSearchedClusters(results[2].status === 'fulfilled' ? results[2].value.data.data || [] : []);
        setRacks(results[3].status === 'fulfilled' ? results[3].value.data.data || [] : []);
        setPhysicalServers(results[4].status === 'fulfilled' ? results[4].value.data.data || [] : []);
        setInventoryItems(results[5].status === 'fulfilled' ? results[5].value.data.data || [] : []);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  const clusterMap = React.useMemo(() => {
    return new Map(clusters.map(c => [c.id, c.clusterName]));
  }, [clusters]);

  // Map API response to standardized search result structure
  const allResults = React.useMemo(() => {
    const items: SearchResultItem[] = [];

    // Map Nodes
    nodes.forEach(node => {
      items.push({
        type: 'node',
        id: node.id || node._id,
        clusterName: clusterMap.get(node.clusterId) || 'Unknown Cluster',
        name: node.hostName || 'Unnamed Node',
        subtitle: `IP: ${node.ipAddress || 'No IP'} | Rack: ${node.rack || 'No Rack'}`,
        data: node
      });
    });

    // Map VMs
    vms.forEach(vm => {
      items.push({
        type: 'vm',
        id: vm.id || vm._id,
        clusterName: clusterMap.get(vm.clusterId) || 'Unknown Cluster',
        name: vm.ipAddress || 'Unnamed VM',
        subtitle: `App: ${vm.applications || 'General'} | Node: ${vm.node || 'Unknown'}`,
        data: vm
      });
    });

    // Map Clusters
    searchedClusters.forEach(cluster => {
      items.push({
        type: 'cluster',
        id: cluster.id || cluster._id,
        clusterName: cluster.clusterName || 'Unknown',
        name: cluster.clusterName || 'Unnamed Cluster',
        subtitle: `IP: ${cluster.ipAddress || 'No IP'}`,
        data: cluster
      });
    });

    // Map Racks
    racks.forEach(rack => {
      items.push({
        type: 'rack',
        id: rack.id || rack._id,
        clusterName: '',
        name: rack.serverRack || 'Unnamed Rack',
        subtitle: `Capacity: ${rack.rackCapacity || '--'} U | Temp: ${rack.temperature ?? '--'} °C`,
        data: rack
      });
    });

    // Map Physical Servers
    physicalServers.forEach(ps => {
      items.push({
        type: 'physical_server',
        id: ps.id || ps._id,
        clusterName: clusterMap.get(ps.clusterId) || 'Unknown Cluster',
        name: ps.ipAddress || ps.applications || 'Unnamed Server',
        subtitle: `Node: ${ps.node || 'Unknown'} | App: ${ps.applications || 'General'}`,
        data: ps
      });
    });

    // Map Inventory
    inventoryItems.forEach(inv => {
      items.push({
        type: 'inventory',
        id: inv.id || inv._id,
        clusterName: inv.department || '',
        name: inv.itemName || 'Unnamed Item',
        subtitle: `Qty: ${inv.quantity ?? 0} | ${inv.isReturnable ? 'Returnable' : 'Consumable'}`,
        data: inv
      });
    });

    return items;
  }, [nodes, vms, searchedClusters, racks, physicalServers, inventoryItems, clusterMap]);

  // Filtered results
  const filteredResults = React.useMemo(() => {
    if (filterType === 'all') return allResults;
    return allResults.filter(item => item.type === filterType);
  }, [allResults, filterType]);

  // Automatically select the first result when query or filter changes and selectedItem is no longer valid
  useEffect(() => {
    if (filteredResults.length > 0) {
      // Check if current selection is still in filtered results
      const exists = filteredResults.some(item => item.id === selectedItem?.id && item.type === selectedItem?.type);
      if (!exists) {
        setSelectedItem(filteredResults[0]);
      }
    } else {
      setSelectedItem(null);
    }
  }, [filteredResults, selectedItem]);

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', gap: 3 }}>
      {/* Search Header */}
      <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Grid container spacing={2}  sx={{ alignItems: 'center' }} >
          <Grid size={{xs: 12, md: 4}}   >
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search by IP, name, rack, node, app, tag, inventory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{ input: { startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ fontSize: '1.5rem', color: '#757575' }} />
                  </InputAdornment>
                ),
                style: { borderRadius: '12px' }
              } }}
            />
          </Grid>
          <Grid size={{xs: 12, md: 8}}    sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <ToggleButtonGroup
              value={filterType}
              exclusive
              onChange={(e, val) => val && setFilterType(val)}
              aria-label="filter type"
              size="small"
              sx={{ bgcolor: 'rgba(0,0,0,0.02)', p: 0.5, borderRadius: '12px', flexWrap: 'wrap', gap: 0.5 }}
            >
              <ToggleButton value="all" sx={{ border: 'none', borderRadius: '8px !important', px: 2 }}>
                All ({allResults.length})
              </ToggleButton>
              <ToggleButton value="node" sx={{ border: 'none', borderRadius: '8px !important', px: 2 }}>
                Nodes ({allResults.filter(r => r.type === 'node').length})
              </ToggleButton>
              <ToggleButton value="vm" sx={{ border: 'none', borderRadius: '8px !important', px: 2 }}>
                VMs ({allResults.filter(r => r.type === 'vm').length})
              </ToggleButton>
              <ToggleButton value="cluster" sx={{ border: 'none', borderRadius: '8px !important', px: 2 }}>
                Clusters ({allResults.filter(r => r.type === 'cluster').length})
              </ToggleButton>
              <ToggleButton value="rack" sx={{ border: 'none', borderRadius: '8px !important', px: 2 }}>
                Racks ({allResults.filter(r => r.type === 'rack').length})
              </ToggleButton>
              <ToggleButton value="physical_server" sx={{ border: 'none', borderRadius: '8px !important', px: 2 }}>
                Phys Servers ({allResults.filter(r => r.type === 'physical_server').length})
              </ToggleButton>
              <ToggleButton value="inventory" sx={{ border: 'none', borderRadius: '8px !important', px: 2 }}>
                Inventory ({allResults.filter(r => r.type === 'inventory').length})
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Panel - Split screen */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, gap: 3 }}>
        {/* Left Side: Results List */}
        <Paper 
          sx={{ 
            width: '380px', 
            borderRadius: 3, 
            display: 'flex', 
            flexDirection: 'column', 
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
              Results ({filteredResults.length})
            </Typography>
            {loading && <CircularProgress size={18} />}
          </Box>
          
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {!searchQuery.trim() ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                  Type in the search bar above to begin searching the clusters...
                </Typography>
              </Box>
            ) : filteredResults.length === 0 && !loading ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                  No items found matching "{searchQuery}"
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {filteredResults.map((item) => {
                  const isSelected = selectedItem?.id === item.id && selectedItem?.type === item.type;
                  return (
                    <ListItem key={`${item.type}-${item.id}`} disablePadding>
                      <ListItemButton 
                        selected={isSelected}
                        onClick={() => setSelectedItem(item)}
                        sx={{ 
                          py: 1.5, 
                          px: 2,
                          borderLeft: isSelected ? `4px solid ${
                            item.type === 'node' ? '#1976d2' :
                            item.type === 'vm' ? '#2e7d32' :
                            item.type === 'cluster' ? '#ed6c02' :
                            item.type === 'rack' ? '#9c27b0' :
                            item.type === 'physical_server' ? '#0288d1' :
                            '#e91e63'
                          }` : '4px solid transparent',
                          '&.Mui-selected': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)',
                            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.08)' }
                          }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          {getItemIcon(item.type)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                                {item.name}
                              </Typography>
                              <Chip 
                                label={getChipLabel(item.type)} 
                                size="small" 
                                color={getChipColor(item.type)}
                                variant="outlined"
                                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 'bold' }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="caption" color="textSecondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.subtitle}
                              </Typography>
                              <Typography variant="caption" color="primary" sx={{ display: 'block', fontWeight: 500, fontSize: '0.7rem', mt: 0.2 }}>
                                {item.clusterName}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItemButton>
                      <Divider variant="inset" component="li" style={{ margin: 0, opacity: 0.6 }} />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Box>
        </Paper>

        {/* Right Side: Detailed View */}
        <Paper 
          sx={{ 
            flex: 1, 
            borderRadius: 3, 
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {selectedItem ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Detailed Header */}
              <Box 
                sx={{ 
                  p: 3, 
                  bgcolor: 
                    selectedItem.type === 'node' ? 'rgba(25, 118, 210, 0.04)' :
                    selectedItem.type === 'vm' ? 'rgba(46, 125, 50, 0.04)' :
                    selectedItem.type === 'cluster' ? 'rgba(237, 108, 2, 0.04)' :
                    selectedItem.type === 'rack' ? 'rgba(156, 39, 176, 0.04)' :
                    selectedItem.type === 'physical_server' ? 'rgba(2, 136, 209, 0.04)' :
                    'rgba(233, 30, 99, 0.04)',
                  borderBottom: '1px solid rgba(0,0,0,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2
                }}
              >
                {getDetailedIcon(selectedItem.type)}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                    {selectedItem.name}
                  </Typography>
                  {selectedItem.clusterName && (
                    <Typography variant="subtitle2" color="textSecondary">
                      Cluster/Department: {selectedItem.clusterName}
                    </Typography>
                  )}
                </Box>
                <Chip 
                  label={getChipLabel(selectedItem.type)}
                  color={getChipColor(selectedItem.type)}
                  sx={{ fontWeight: 'bold', px: 1 }}
                />
              </Box>

              {/* Detailed Fields Body */}
              <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
                {selectedItem.type === 'node' ? (
                  // Node Detailed Fields
                  <Grid container spacing={3}>
                    {/* Specifications Card */}
                    <Grid size={{xs: 12, md: 6}}   >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InfoIcon color="#1976d2" /> Hardware Specifications
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Total RAM</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <RamIcon /> {selectedItem.data.totalRam ? `${selectedItem.data.totalRam} GB` : '--'}
                            </Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Available RAM</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <RamIcon /> {selectedItem.data.availableRam ? `${selectedItem.data.availableRam} GB` : '--'}
                            </Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Total HDD</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <HddIcon /> {selectedItem.data.totalHardisk ? `${selectedItem.data.totalHardisk} GB` : '--'}
                            </Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Available HDD</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <HddIcon /> {selectedItem.data.availableHardisk ? `${selectedItem.data.availableHardisk} GB` : '--'}
                            </Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Total CPU Cores</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CpuIcon /> {selectedItem.data.totalCpu ? `${selectedItem.data.totalCpu} Cores` : '--'}
                            </Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Available CPU Cores</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CpuIcon /> {selectedItem.data.availableCpu ? `${selectedItem.data.availableCpu} Cores` : '--'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    {/* Server details */}
                    <Grid size={{xs: 12, md: 6}}   >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ClusterIcon color="#1976d2" /> System & Environment
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">IP Address</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.ipAddress || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Rack Location</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.rack || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Server Model</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.serverModel || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Serial Number</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.serialNumber || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Hypervisor</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.hypervisor || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Cluster Type</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.clusterType || '--'}</Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    {/* Allocation & Administration details */}
                    <Grid size={{xs: 12}}  >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PersonIcon color="#1976d2" /> Administration & Procurement
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 6, md: 3}}   >
                            <Typography variant="caption" color="textSecondary">Admin</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.admin || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6, md: 3}}   >
                            <Typography variant="caption" color="textSecondary">Admin Code</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.adminCode || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6, md: 3}}   >
                            <Typography variant="caption" color="textSecondary">Indentor</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.indentor || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6, md: 3}}   >
                            <Typography variant="caption" color="textSecondary">Custodian</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.custodian || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6, md: 3}}   >
                            <Typography variant="caption" color="textSecondary">PO Number</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.poNum || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6, md: 3}}   >
                            <Typography variant="caption" color="textSecondary">Asset Number</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.assetNum || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6, md: 3}}   >
                            <Typography variant="caption" color="textSecondary">Redundancy Power</Typography>
                            <Chip 
                              label={selectedItem.data.redundancyPower || 'No'} 
                              size="small" 
                              color={selectedItem.data.redundancyPower === 'Yes' ? 'success' : 'default'}
                              sx={{ fontWeight: 'bold', mt: 0.5 }}
                            />
                          </Grid>
                          <Grid size={{xs: 12}}  >
                            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Applications Running</Typography>
                            <Typography variant="body1" sx={{ bgcolor: 'rgba(0,0,0,0.02)', p: 1.5, borderRadius: 1.5, border: '1px solid rgba(0,0,0,0.05)', fontWeight: 500 }}>
                              {selectedItem.data.applications || 'No applications registered.'}
                            </Typography>
                          </Grid>
                          {selectedItem.data.remarks && (
                            <Grid size={{xs: 12}}  >
                              <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Remarks</Typography>
                              <Typography variant="body1" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                                "{selectedItem.data.remarks}"
                              </Typography>
                            </Grid>
                          )}
                        </Grid>
                      </Paper>
                    </Grid>
                  </Grid>
                ) : selectedItem.type === 'vm' ? (
                  // VM Detailed Fields
                  <Grid container spacing={3}>
                    {/* Resource Allocation */}
                    <Grid size={{xs: 12, md: 6}}   >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InfoIcon color="#2e7d32" /> Allocated Resources
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 4}}  >
                            <Typography variant="caption" color="textSecondary">RAM</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <RamIcon /> {selectedItem.data.ram ? `${selectedItem.data.ram} GB` : '--'}
                            </Typography>
                          </Grid>
                          <Grid size={{xs: 4}}  >
                            <Typography variant="caption" color="textSecondary">HDD</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <HddIcon /> {selectedItem.data.hdd ? `${selectedItem.data.hdd} GB` : '--'}
                            </Typography>
                          </Grid>
                          <Grid size={{xs: 4}}  >
                            <Typography variant="caption" color="textSecondary">CPU Cores</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CpuIcon /> {selectedItem.data.cpu ? `${selectedItem.data.cpu} Cores` : '--'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    {/* OS and Node details */}
                    <Grid size={{xs: 12, md: 6}}   >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ClusterIcon color="#2e7d32" /> System Environment
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Host Node</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.node || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">IP Address</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.ipAddress || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 12}}  >
                            <Typography variant="caption" color="textSecondary">OS and Expiry Details</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.osAndExpiry || '--'}</Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    {/* Applications details */}
                    <Grid size={{xs: 12}}  >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AppIcon color="#2e7d32" /> Applications
                        </Typography>
                        <Typography variant="body1" sx={{ bgcolor: 'rgba(0,0,0,0.02)', p: 2, borderRadius: 1.5, border: '1px solid rgba(0,0,0,0.05)', fontWeight: 500 }}>
                          {selectedItem.data.applications || 'No registered applications.'}
                        </Typography>
                      </Paper>
                    </Grid>

                    {/* Registration metadata */}
                    <Grid size={{xs: 12}}  >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TagIcon color="#2e7d32" /> Registration Metadata
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 6, md: 4}}   >
                            <Typography variant="caption" color="textSecondary">Created By</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.createdBy || 'System'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6, md: 4}}   >
                            <Typography variant="caption" color="textSecondary">Created At</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <DateIcon /> {selectedItem.data.createdAt ? new Date(selectedItem.data.createdAt).toLocaleDateString() : '--'}
                            </Typography>
                          </Grid>
                          <Grid size={{xs: 6, md: 4}}   >
                            <Typography variant="caption" color="textSecondary">Updated At</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <DateIcon /> {selectedItem.data.updatedAt ? new Date(selectedItem.data.updatedAt).toLocaleDateString() : '--'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>
                  </Grid>
                ) : selectedItem.type === 'cluster' ? (
                  // Cluster Detailed Fields
                  <Grid container spacing={3}>
                    <Grid size={{xs: 12}}  >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ClusterIcon color="#ed6c02" /> Cluster Information
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Cluster Name</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.clusterName || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">IP Address / Range</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.ipAddress || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Serial Number (SL)</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.slNumber || '--'}</Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>
                    {/* Metadata */}
                    <Grid size={{xs: 12}}  >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TagIcon color="#ed6c02" /> Metadata
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Created By</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.createdBy || 'System'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Last Updated</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <DateIcon /> {selectedItem.data.updatedAt ? new Date(selectedItem.data.updatedAt).toLocaleDateString() : '--'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>
                  </Grid>
                ) : selectedItem.type === 'rack' ? (
                  // Rack Detailed Fields
                  <Grid container spacing={3}>
                    <Grid size={{xs: 12, md: 6}}   >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <HddIcon color="#9c27b0" /> Rack Specifications
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Rack Name</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.serverRack || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Capacity (U)</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.rackCapacity ? `${selectedItem.data.rackCapacity} U` : '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Remaining Capacity (U)</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main' }}>
                              {selectedItem.data.remainingCapacity !== undefined ? `${selectedItem.data.remainingCapacity} U` : '--'}
                            </Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Temperature</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {selectedItem.data.temperature !== undefined ? `${selectedItem.data.temperature} °C` : '--'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    <Grid size={{xs: 12, md: 6}}   >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CpuIcon color="#9c27b0" /> Features & Power
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Fan Available</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {selectedItem.data.fanAvailable ? 'Yes' : 'No'}
                            </Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Spare Power</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {selectedItem.data.sparePowerAvailability ? 'Yes' : 'No'}
                            </Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Spare Power C-30</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {selectedItem.data.sparePowerC30 || '--'}
                            </Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Spare Power C-90</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {selectedItem.data.sparePowerC90 || '--'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    <Grid size={{xs: 12}}  >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AppIcon color="#9c27b0" /> Networks Available
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {selectedItem.data.networksAvailable && selectedItem.data.networksAvailable.length > 0 ? (
                            selectedItem.data.networksAvailable.map((net: string) => (
                              <Chip key={net} label={net} size="small" variant="outlined" color="secondary" />
                            ))
                          ) : (
                            <Typography variant="body2" color="textSecondary">No networks registered.</Typography>
                          )}
                        </Box>
                      </Paper>
                    </Grid>

                    {selectedItem.data.remarks && (
                      <Grid size={{xs: 12}}  >
                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Remarks</Typography>
                        <Typography variant="body1" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                          "{selectedItem.data.remarks}"
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                ) : selectedItem.type === 'physical_server' ? (
                  // Physical Server Detailed Fields
                  <Grid container spacing={3}>
                    <Grid size={{xs: 12, md: 6}}   >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <NodeIcon color="#0288d1" /> System Resources
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 4}}  >
                            <Typography variant="caption" color="textSecondary">RAM</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.ram || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 4}}  >
                            <Typography variant="caption" color="textSecondary">HDD</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.hdd || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 4}}  >
                            <Typography variant="caption" color="textSecondary">CPU</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.cpu || '--'}</Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    <Grid size={{xs: 12, md: 6}}   >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ClusterIcon color="#0288d1" /> Environment Details
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Host Node</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.node || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">IP Address</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.ipAddress || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 12}}  >
                            <Typography variant="caption" color="textSecondary">OS and Expiry Details</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.osAndExpiry || '--'}</Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    <Grid size={{xs: 12}}  >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AppIcon color="#0288d1" /> Application and Backup
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 12}}  >
                            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Applications Running</Typography>
                            <Typography variant="body1" sx={{ bgcolor: 'rgba(0,0,0,0.02)', p: 1.5, borderRadius: 1.5, border: '1px solid rgba(0,0,0,0.05)', fontWeight: 500 }}>
                              {selectedItem.data.applications || 'No applications registered.'}
                            </Typography>
                          </Grid>
                          <Grid size={{xs: 12}}  >
                            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Backup Location</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.backupLocation || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Added to Monitoring</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.addedToMonitoring ? 'Yes' : 'No'}</Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>
                  </Grid>
                ) : (
                  // Inventory Detailed Fields
                  <Grid container spacing={3}>
                    <Grid size={{xs: 12, md: 6}}   >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TagIcon color="#e91e63" /> Item Details
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Item Name</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.itemName || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Quantity Available</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main' }}>{selectedItem.data.quantity ?? 0}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Type</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {selectedItem.data.isReturnable ? 'Returnable' : 'Consumable'}
                            </Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Department</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.department || '--'}</Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    <Grid size={{xs: 12, md: 6}}   >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InfoIcon color="#e91e63" /> Storage Location
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Almira Number</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.almiraNumber || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Rack Number</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.rackNumber || '--'}</Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    {selectedItem.data.description && (
                      <Grid size={{xs: 12}}  >
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Description</Typography>
                          <Typography variant="body1">{selectedItem.data.description}</Typography>
                        </Paper>
                      </Grid>
                    )}

                    {/* Meta info */}
                    <Grid size={{xs: 12}}  >
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Grid container spacing={2}>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Last Updated By</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.lastUpdatedBy || '--'}</Typography>
                          </Grid>
                          <Grid size={{xs: 6}}  >
                            <Typography variant="caption" color="textSecondary">Last Updated Date</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {selectedItem.data.lastUpdatedDate ? new Date(selectedItem.data.lastUpdatedDate).toLocaleDateString() : '--'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>
                  </Grid>
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, p: 4, textAlign: 'center' }}>
              <SearchIcon style={{ fontSize: '4.5rem', color: 'rgba(0,0,0,0.15)', marginBottom: '16px' }} />
              <Typography variant="h6" color="textSecondary" sx={{ fontWeight: 'bold' }}>
                No Item Selected
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1, maxWidth: '300px' }}>
                Select any item from the search results on the left panel to view its full details.
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default Search;