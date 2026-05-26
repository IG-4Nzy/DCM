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
  type: 'node' | 'vm';
  id: string;
  clusterName: string;
  name: string;
  subtitle: string;
  data: any;
}

const Search: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'node' | 'vm'>('all');
  
  const [nodes, setNodes] = useState<any[]>([]);
  const [vms, setVms] = useState<any[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
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

  // Fetch Node and VM details based on debounced search query
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim()) {
        setNodes([]);
        setVms([]);
        setSelectedItem(null);
        return;
      }

      setLoading(true);
      try {
        const [nodeRes, vmRes] = await Promise.all([
          request.get('/api/node-details', { params: { pagination: false, search: debouncedQuery } }),
          request.get('/api/vm-details', { params: { pagination: false, search: debouncedQuery } })
        ]);

        setNodes(nodeRes.data.data || []);
        setVms(vmRes.data.data || []);
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

    return items;
  }, [nodes, vms, clusterMap]);

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
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search nodes or VMs by IP, Hostname, App, Rack, CPU, OS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ fontSize: '1.5rem', color: '#757575' }} />
                  </InputAdornment>
                ),
                style: { borderRadius: '12px' }
              }}
            />
          </Grid>
          <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <ToggleButtonGroup
              value={filterType}
              exclusive
              onChange={(e, val) => val && setFilterType(val)}
              aria-label="filter type"
              size="medium"
              sx={{ bgcolor: 'rgba(0,0,0,0.02)', p: 0.5, borderRadius: '12px' }}
            >
              <ToggleButton value="all" sx={{ border: 'none', borderRadius: '8px !important', px: 3 }}>
                All ({allResults.length})
              </ToggleButton>
              <ToggleButton value="node" sx={{ border: 'none', borderRadius: '8px !important', px: 3 }}>
                Nodes ({allResults.filter(r => r.type === 'node').length})
              </ToggleButton>
              <ToggleButton value="vm" sx={{ border: 'none', borderRadius: '8px !important', px: 3 }}>
                VMs ({allResults.filter(r => r.type === 'vm').length})
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
                  No nodes or VMs found matching "{searchQuery}"
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
                          borderLeft: isSelected ? '4px solid #1976d2' : '4px solid transparent',
                          '&.Mui-selected': {
                            bgcolor: 'rgba(25, 118, 210, 0.08)',
                            '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.12)' }
                          }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          {item.type === 'node' ? (
                            <NodeIcon style={{ color: '#1976d2', fontSize: '1.5rem' }} />
                          ) : (
                            <VmIcon style={{ color: '#2e7d32', fontSize: '1.5rem' }} />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                                {item.name}
                              </Typography>
                              <Chip 
                                label={item.type === 'node' ? 'Node' : 'VM'} 
                                size="small" 
                                color={item.type === 'node' ? 'primary' : 'success'}
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
                  bgcolor: selectedItem.type === 'node' ? 'rgba(25, 118, 210, 0.04)' : 'rgba(46, 125, 50, 0.04)',
                  borderBottom: '1px solid rgba(0,0,0,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2
                }}
              >
                {selectedItem.type === 'node' ? (
                  <NodeIcon style={{ fontSize: '2.5rem', color: '#1976d2' }} />
                ) : (
                  <VmIcon style={{ fontSize: '2.5rem', color: '#2e7d32' }} />
                )}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                    {selectedItem.name}
                  </Typography>
                  <Typography variant="subtitle2" color="textSecondary">
                    Cluster: {selectedItem.clusterName}
                  </Typography>
                </Box>
                <Chip 
                  label={selectedItem.type === 'node' ? 'Physical Node' : 'Virtual Machine'}
                  color={selectedItem.type === 'node' ? 'primary' : 'success'}
                  sx={{ fontWeight: 'bold', px: 1 }}
                />
              </Box>

              {/* Detailed Fields Body */}
              <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
                {selectedItem.type === 'node' ? (
                  // Node Detailed Fields
                  <Grid container spacing={3}>
                    {/* Specifications Card */}
                    <Grid item xs={12} md={6}>
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InfoIcon color="#1976d2" /> Hardware Specifications
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Total RAM</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <RamIcon /> {selectedItem.data.totalRam ? `${selectedItem.data.totalRam} GB` : '--'}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Available RAM</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <RamIcon /> {selectedItem.data.availableRam ? `${selectedItem.data.availableRam} GB` : '--'}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Total HDD</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <HddIcon /> {selectedItem.data.totalHardisk ? `${selectedItem.data.totalHardisk} GB` : '--'}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Available HDD</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <HddIcon /> {selectedItem.data.availableHardisk ? `${selectedItem.data.availableHardisk} GB` : '--'}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Total CPU Cores</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CpuIcon /> {selectedItem.data.totalCpu ? `${selectedItem.data.totalCpu} Cores` : '--'}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Available CPU Cores</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CpuIcon /> {selectedItem.data.availableCpu ? `${selectedItem.data.availableCpu} Cores` : '--'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    {/* Server details */}
                    <Grid item xs={12} md={6}>
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ClusterIcon color="#1976d2" /> System & Environment
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">IP Address</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.ipAddress || '--'}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Rack Location</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.rack || '--'}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Server Model</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.serverModel || '--'}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Serial Number</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.serialNumber || '--'}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Hypervisor</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.hypervisor || '--'}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Cluster Type</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.clusterType || '--'}</Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    {/* Allocation & Administration details */}
                    <Grid item xs={12}>
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PersonIcon color="#1976d2" /> Administration & Procurement
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="textSecondary">Admin</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.admin || '--'}</Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="textSecondary">Admin Code</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.adminCode || '--'}</Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="textSecondary">Indentor</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.indentor || '--'}</Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="textSecondary">Custodian</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.custodian || '--'}</Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="textSecondary">PO Number</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.poNum || '--'}</Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="textSecondary">Asset Number</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.assetNum || '--'}</Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="textSecondary">Redundancy Power</Typography>
                            <Chip 
                              label={selectedItem.data.redundancyPower || 'No'} 
                              size="small" 
                              color={selectedItem.data.redundancyPower === 'Yes' ? 'success' : 'default'}
                              sx={{ fontWeight: 'bold', mt: 0.5 }}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>Applications Running</Typography>
                            <Typography variant="body1" sx={{ bgcolor: 'rgba(0,0,0,0.02)', p: 1.5, borderRadius: 1.5, border: '1px solid rgba(0,0,0,0.05)', fontWeight: 500 }}>
                              {selectedItem.data.applications || 'No applications registered.'}
                            </Typography>
                          </Grid>
                          {selectedItem.data.remarks && (
                            <Grid item xs={12}>
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
                ) : (
                  // VM Detailed Fields
                  <Grid container spacing={3}>
                    {/* Resource Allocation */}
                    <Grid item xs={12} md={6}>
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InfoIcon color="#2e7d32" /> Allocated Resources
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="textSecondary">RAM</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <RamIcon /> {selectedItem.data.ram ? `${selectedItem.data.ram} GB` : '--'}
                            </Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="textSecondary">HDD</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <HddIcon /> {selectedItem.data.hdd ? `${selectedItem.data.hdd} GB` : '--'}
                            </Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="textSecondary">CPU Cores</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CpuIcon /> {selectedItem.data.cpu ? `${selectedItem.data.cpu} Cores` : '--'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    {/* OS and Node details */}
                    <Grid item xs={12} md={6}>
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ClusterIcon color="#2e7d32" /> System Environment
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">Host Node</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.node || '--'}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="textSecondary">IP Address</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.ipAddress || '--'}</Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="caption" color="textSecondary">OS and Expiry Details</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.osAndExpiry || '--'}</Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    {/* Applications details */}
                    <Grid item xs={12}>
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
                    <Grid item xs={12}>
                      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TagIcon color="#2e7d32" /> Registration Metadata
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6} md={4}>
                            <Typography variant="caption" color="textSecondary">Created By</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedItem.data.createdBy || 'System'}</Typography>
                          </Grid>
                          <Grid item xs={6} md={4}>
                            <Typography variant="caption" color="textSecondary">Created At</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <DateIcon /> {selectedItem.data.createdAt ? new Date(selectedItem.data.createdAt).toLocaleDateString() : '--'}
                            </Typography>
                          </Grid>
                          <Grid item xs={6} md={4}>
                            <Typography variant="caption" color="textSecondary">Updated At</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <DateIcon /> {selectedItem.data.updatedAt ? new Date(selectedItem.data.updatedAt).toLocaleDateString() : '--'}
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
                Select any Node or VM from the search results on the left panel to view its full details.
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default Search;