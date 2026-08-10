// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  TextField, 
  IconButton, 
  Tooltip, 
  CircularProgress,
  Chip,
  Collapse
} from '@mui/material';
import { MdRefresh as RefreshIcon, MdSearch as SearchIcon, MdChevronRight as ExpandIcon, MdExpandMore as CollapseIcon } from 'react-icons/md';
import request from '../../services/request';
import dayjs from 'dayjs';

interface AuditLog {
  id?: string;
  _id?: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  ipAddress?: string;
  beforeState?: any;
  afterState?: any;
}

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
  // Set a large limit to allow clean scrolling of up to 300 logs
  const limit = 300;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await request.get(`/api/logs/`, {
        params: {
          skip: 0,
          limit,
          search: search || undefined
        }
      });
      setLogs(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error("Failed to fetch audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search]);

  const handleRefresh = () => {
    fetchLogs();
  };

  const handleToggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const getActionColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('delete')) return 'error';
    if (act.includes('create') || act.includes('publish') || act.includes('register')) return 'success';
    if (act.includes('update') || act.includes('advance')) return 'info';
    if (act.includes('login')) return 'warning';
    return 'default';
  };

  const getChangedFields = (before: any, after: any) => {
    if (!before || !after) return null;
    const changes: { field: string; from: any; to: any }[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    
    allKeys.forEach(key => {
      if (key === 'updatedAt' || key === 'timestamp' || key === 'history' || key === 'date') return;
      const valBefore = before[key];
      const valAfter = after[key];
      
      if (JSON.stringify(valBefore) !== JSON.stringify(valAfter)) {
        changes.push({
          field: key,
          from: valBefore === undefined ? '[undefined]' : valBefore,
          to: valAfter === undefined ? '[undefined]' : valAfter
        });
      }
    });
    return changes;
  };

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Clean Header Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1a202c' }}>
            Audit Logs
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
            Track and monitor application requests, visitor access, changes, creations, and deletions.
          </Typography>
        </Box>
        <Tooltip title="Refresh Logs">
          <IconButton onClick={handleRefresh} sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Main Filter & List Container */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          borderRadius: 3, 
          border: '1px solid #e2e8f0', 
          bgcolor: '#ffffff',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
        }}
      >
        {/* Search Input and Record Counter */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 3, 
            gap: 2, 
            flexWrap: 'wrap' 
          }}
        >
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search operator, action, details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <SearchIcon style={{ color: '#a0aec0', marginRight: '8px' }} /> } }}
            sx={{ 
              width: '350px',
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                bgcolor: '#f8fafc'
              }
            }}
          />
          <Typography variant="body2" sx={{ fontWeight: '600', color: '#4a5568' }}>
            Total Records: <span style={{ color: '#3182ce' }}>{total}</span>
          </Typography>
        </Box>

        {/* Loading Spinner */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
            <CircularProgress size={40} />
          </Box>
        ) : logs.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <Typography variant="body1" color="textSecondary">
              No audit logs found matching your query.
            </Typography>
          </Box>
        ) : (
          /* Scrollable Logs List View */
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 1.5,
              maxHeight: '650px',
              overflowY: 'auto',
              pr: 1,
              '&::-webkit-scrollbar': {
                width: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f1f1',
                borderRadius: '8px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#cbd5e0',
                borderRadius: '8px',
                '&:hover': {
                  background: '#a0aec0',
                }
              }
            }}
          >
            {logs.map((log) => {
              const logId = log.id || log._id || '';
              const isExpanded = expandedLogId === logId;
              const formattedDate = dayjs(log.timestamp.replace(/\+00:00Z$/, 'Z').replace(/\+00:00$/, 'Z')).format('DD-MM-YYYY h:mm:ss A');
              
              return (
                <Box 
                  key={logId}
                  sx={{ 
                    border: '1px solid #edf2f7', 
                    borderRadius: '8px', 
                    bgcolor: isExpanded ? '#f7fafc' : '#ffffff',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: '#f7fafc',
                      borderColor: '#cbd5e0'
                    }
                  }}
                >
                  {/* Log Row Header */}
                  <Box 
                    onClick={() => handleToggleExpand(logId)}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2.5, 
                      p: 2, 
                      cursor: 'pointer',
                      flexWrap: 'wrap'
                    }}
                  >
                    {isExpanded ? <CollapseIcon style={{ color: '#4a5568' }} /> : <ExpandIcon style={{ color: '#a0aec0' }} />}
                    
                    {/* Timestamp */}
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#718096', 
                        fontWeight: '500',
                        minWidth: '170px' 
                      }}
                    >
                      {formattedDate}
                    </Typography>

                    {/* Operator */}
                    <Box sx={{ minWidth: '150px' }}>
                      <Typography variant="body2" sx={{ fontWeight: '600', color: '#2d3748' }}>
                        {log.user}
                      </Typography>
                    </Box>

                    {/* Action Chip */}
                    <Chip 
                      label={log.action} 
                      size="small"
                      color={getActionColor(log.action)}
                      variant="filled"
                      sx={{ 
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase'
                      }} 
                    />

                    {/* Action Details description */}
                    <Typography 
                      variant="body2" 
                      noWrap 
                      sx={{ 
                        color: '#4a5568', 
                        flex: 1, 
                        minWidth: '250px'
                      }}
                    >
                      {log.details}
                    </Typography>

                    {/* IP Address */}
                    {log.ipAddress && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: '#a0aec0', 
                          fontFamily: 'monospace',
                          ml: 'auto'
                        }}
                      >
                        IP: {log.ipAddress}
                      </Typography>
                    )}
                  </Box>

                  {/* Expanded JSON Detail panel */}
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid #edf2f7', m: 1.5, borderRadius: '6px' }}>
                      {/* Changed Fields Highlights */}
                      {log.beforeState && log.afterState && (
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#2d3748', mb: 1.5 }}>
                            Changed Fields:
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 1, mb: 2 }}>
                            {getChangedFields(log.beforeState, log.afterState)?.map((change, i) => (
                              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontFamily: 'monospace', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                                <Chip label={change.field} size="small" variant="outlined" sx={{ fontWeight: 'bold', height: '20px' }} />
                                <span style={{ color: '#e53e3e', textDecoration: 'line-through', backgroundColor: 'rgba(229, 62, 62, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                  {JSON.stringify(change.from)}
                                </span>
                                <span style={{ color: '#718096' }}>➔</span>
                                <span style={{ color: '#38a169', fontWeight: 'bold', backgroundColor: 'rgba(56, 161, 105, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                                  {JSON.stringify(change.to)}
                                </span>
                              </Box>
                            )) || <Typography variant="caption" color="textSecondary">No data fields were modified.</Typography>}
                          </Box>
                        </Box>
                      )}

                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#4a5568', mb: 1.5 }}>
                        Raw Log Metadata Details
                      </Typography>
                      <pre 
                        style={{ 
                          margin: 0, 
                          color: '#2d3748', 
                          fontFamily: 'Consolas, Monaco, monospace', 
                          fontSize: '0.85rem',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          backgroundColor: '#ffffff',
                          padding: '16px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                        }}
                      >
                        {JSON.stringify(log, null, 2)}
                      </pre>
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default AuditLogs;
