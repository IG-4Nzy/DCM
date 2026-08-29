// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Grid, Typography, Divider, Chip, CircularProgress, Paper } from '@mui/material';
import Modal from '../../../components/Modal';
import { fetchVMHistory } from './action';
import { 
  MdComputer, 
  MdDns, 
  MdStorage, 
  MdMemory, 
  MdPower, 
  MdPerson, 
  MdContactPhone, 
  MdEvent, 
  MdBookmarkBorder, 
  MdBackup, 
  MdCheckCircle, 
  MdHistory,
  MdNetworkCheck,
  MdWarning,
  MdCameraAlt
} from 'react-icons/md';
import dayjs from 'dayjs';

interface VMHistoryModalProps {
  open: boolean;
  onClose: () => void;
  vm: any; // VM Details Object
}

const VMHistoryModal: React.FC<VMHistoryModalProps> = ({ open, onClose, vm }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && vm && (vm.id || vm._id)) {
      setLoading(true);
      fetchVMHistory(vm.id || vm._id)
        .then(res => {
          setHistory(res.history || []);
        })
        .catch(err => {
          console.error("Failed to load VM history", err);
          setHistory([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, vm]);

  if (!vm) return null;

  const safeParseDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss');
    } catch {
      return dateStr;
    }
  };

  const getPowerStatusColor = (status?: string) => {
    return (status || 'on').toLowerCase() === 'on' ? '#2e7d32' : '#d32f2f';
  };

  const DetailItem = ({ icon: Icon, label, value, color }: any) => (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5, bgcolor: '#f8fafc', borderRadius: '8px', border: '1px solid #eef2f6' }}>
      <Icon style={{ fontSize: '20px', color: color || '#1565c0', marginTop: '2px' }} />
      <Box>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', wordBreak: 'break-word' }}>
          {value || '--'}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Modal
      open={open}
      handleClose={onClose}
      title={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <MdComputer style={{ fontSize: '24px', color: '#1565c0' }} />
          <span style={{ fontWeight: 'bold' }}>VM Detailed View & History</span>
        </Box>
      }
      maxWidth="md"
    >
      <Grid container spacing={3} sx={{ mt: 0.5 }}>
        {/* Left column: VM Details */}
        <Grid item xs={12} md={5}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            VM Information
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Multiple Snapshots Warning Banner */}
            {vm.snapshots && vm.snapshots.length > 1 && (
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  bgcolor: '#fffbe6',
                  border: '1px solid #ffe58f',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5
                }}
              >
                <MdWarning style={{ fontSize: '22px', color: '#d48806', marginTop: '2px', flexShrink: 0 }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#d48806' }}>
                    WARNING: Multiple Snapshots ({vm.snapshots.length} Active)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#8c6b00', display: 'block', lineHeight: 1.3, mt: 0.3 }}>
                    This VM currently has <strong>{vm.snapshots.length} snapshots</strong>. Having multiple active snapshots increases disk latency and datastore usage.
                  </Typography>
                </Box>
              </Paper>
            )}

            <Box sx={{ p: 2, bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>
                  {vm.vmId || 'VM Details'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip 
                    label={(vm.powerStatus || 'ON').toUpperCase()} 
                    size="small" 
                    sx={{ 
                      bgcolor: getPowerStatusColor(vm.powerStatus) + '15', 
                      color: getPowerStatusColor(vm.powerStatus), 
                      fontWeight: 700,
                      border: `1px solid ${getPowerStatusColor(vm.powerStatus)}30`
                    }} 
                  />
                  <Chip 
                    label={vm.isNetworkConnected !== false ? 'CONNECTED' : 'DISCONNECTED'} 
                    size="small" 
                    sx={{ 
                      bgcolor: (vm.isNetworkConnected !== false ? '#0284c7' : '#64748b') + '15', 
                      color: vm.isNetworkConnected !== false ? '#0284c7' : '#64748b', 
                      fontWeight: 700,
                      border: `1px solid ${(vm.isNetworkConnected !== false ? '#0284c7' : '#64748b')}30`
                    }} 
                  />
                  <Chip 
                    label={vm.networkType ? vm.networkType.toUpperCase() : (vm.ipAddress?.startsWith('192.168') ? 'INTERNET' : vm.ipAddress?.startsWith('10.') ? 'INTRANET' : 'INTERNET')} 
                    size="small" 
                    sx={{ 
                      bgcolor: ((vm.networkType?.toLowerCase() === 'intranet' || vm.ipAddress?.startsWith('10.')) ? '#15803d' : '#0369a1') + '15', 
                      color: (vm.networkType?.toLowerCase() === 'intranet' || vm.ipAddress?.startsWith('10.')) ? '#15803d' : '#0369a1', 
                      fontWeight: 700,
                      border: `1px solid ${((vm.networkType?.toLowerCase() === 'intranet' || vm.ipAddress?.startsWith('10.')) ? '#15803d' : '#0369a1')}30`
                    }} 
                  />
                </Box>
              </Box>

              <Grid container spacing={1.5}>
                {vm.applications && (
                <Grid item xs={12}>
                  <DetailItem icon={MdBookmarkBorder} label="Applications / VM Name" value={vm.applications} />
                </Grid>
                )}
                {vm.ipAddress && (
                <Grid item xs={12} sm={6}>
                  <DetailItem icon={MdDns} label="IP Address" value={vm.ipAddress} />
                </Grid>
                )}
                {vm.node && (
                <Grid item xs={12} sm={6}>
                  <DetailItem icon={MdComputer} label="Host Node" value={vm.node} />
                </Grid>
                )}
                {vm.osAndExpiry && (
                <Grid item xs={12}>
                  <DetailItem icon={MdEvent} label="OS & Expiry" value={vm.osAndExpiry} />
                </Grid>
                )}
                {vm.backupName && (
                <Grid item xs={12} sm={6}>
                  <DetailItem icon={MdBackup} label="Backup Name" value={vm.backupName} />
                </Grid>
                )}
                {vm.backupNode && (
                <Grid item xs={12} sm={6}>
                  <DetailItem icon={MdBackup} label="Backup Node" value={vm.backupNode} />
                </Grid>
                )}
                {vm.backupStorage && (
                <Grid item xs={12} sm={6}>
                  <DetailItem icon={MdStorage} label="Backup Storage" value={vm.backupStorage} />
                </Grid>
                )}
                {vm.datastore && (
                <Grid item xs={12} sm={6}>
                  <DetailItem icon={MdStorage} label="Datastore" value={vm.datastore} />
                </Grid>
                )}
                {vm.backupDatastore && (
                <Grid item xs={12} sm={6}>
                  <DetailItem icon={MdStorage} label="Backup Datastore" value={vm.backupDatastore} />
                </Grid>
                )}
                {vm.hdd && (
                <Grid item xs={4}>
                  <DetailItem icon={MdStorage} label="HDD" value={vm.hdd} color="#ed6c02" />
                </Grid>
                )}
                {vm.ram && (
                <Grid item xs={4}>
                  <DetailItem icon={MdMemory} label="RAM" value={vm.ram} color="#2e7d32" />
                </Grid>
                )}
                {vm.cpu && (
                <Grid item xs={4}>
                  <DetailItem icon={MdDns} label="vCPU" value={vm.cpu} color="#9c27b0" />
                </Grid>
                )}
                
                {vm.adminName && (
                <Grid item xs={12}>
                  <DetailItem icon={MdPerson} label="Admin Name" value={vm.adminName} />
                </Grid>
                )}
                {vm.adminContact && (
                <Grid item xs={12}>
                  <DetailItem icon={MdContactPhone} label="Admin Contact" value={vm.adminContact} />
                </Grid>
                )}
                {vm.clones && vm.clones.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Clones ({vm.clones.length})</Typography>
                  <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {vm.clones.map((c: any, i: number) => (
                      <Typography key={i} variant="caption" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', px: 1, py: 0.5, borderRadius: '4px', display: 'block' }}>
                        <strong>{c.name}</strong>{c.remarks ? ` — ${c.remarks}` : ''}
                      </Typography>
                    ))}
                  </Box>
                </Grid>
                )}
                {vm.snapshots && vm.snapshots.length > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <MdCameraAlt style={{ fontSize: '15px', color: vm.snapshots.length > 1 ? '#d48806' : '#0284c7' }} />
                      Snapshots ({vm.snapshots.length})
                    </Typography>
                    {vm.snapshots.length > 1 && (
                      <Chip 
                        icon={<MdWarning style={{ fontSize: '12px', color: '#d48806' }} />}
                        label="Multiple Snapshots" 
                        size="small" 
                        sx={{ 
                          bgcolor: '#fffbe6', 
                          color: '#d48806', 
                          border: '1px solid #ffe58f', 
                          fontWeight: 700, 
                          fontSize: '10px', 
                          height: '20px' 
                        }} 
                      />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {vm.snapshots.map((s: any, i: number) => (
                      <Box 
                        key={i} 
                        sx={{ 
                          bgcolor: vm.snapshots.length > 1 ? '#fffbe6' : '#f8fafc', 
                          color: vm.snapshots.length > 1 ? '#8c6b00' : '#1e293b', 
                          p: 1.25, 
                          borderRadius: '8px', 
                          border: `1px solid ${vm.snapshots.length > 1 ? '#ffe58f' : '#e2e8f0'}` 
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '12px', color: vm.snapshots.length > 1 ? '#d48806' : '#0f172a' }}>
                            Snapshot #{i + 1}: {s.name || s.snapshotName || `Snapshot-${i + 1}`}
                          </Typography>
                          {s.snapshotId && (
                            <Typography variant="caption" sx={{ fontSize: '10px', color: '#64748b', bgcolor: 'rgba(0,0,0,0.04)', px: 0.8, py: 0.2, borderRadius: '4px' }}>
                              ID: {s.snapshotId}
                            </Typography>
                          )}
                        </Box>
                        {(s.description || s.remarks) && (
                          <Typography variant="caption" sx={{ display: 'block', mt: 0.4, color: '#475569', fontSize: '11px' }}>
                            {s.description || s.remarks}
                          </Typography>
                        )}
                        {s.createdAt && (
                          <Typography variant="caption" sx={{ display: 'block', fontSize: '10px', color: '#94a3b8', mt: 0.3 }}>
                            Created At: {safeParseDate(s.createdAt)}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Grid>
                )}
                {vm.templates && vm.templates.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Templates ({vm.templates.length})</Typography>
                  <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {vm.templates.map((t, i) => (
                      <Typography key={i} variant="caption" sx={{ bgcolor: '#f3e8ff', color: '#6b21a8', px: 1, py: 0.5, borderRadius: '4px', display: 'block' }}>
                        <strong>{t.name}</strong>{t.remarks ? ` — ${t.remarks}` : ''}
                      </Typography>
                    ))}
                  </Box>
                </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <DetailItem icon={MdPerson} label="Created By" value={vm.createdBy || '--'} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DetailItem icon={MdEvent} label="Created At" value={safeParseDate(vm.createdAt)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DetailItem icon={MdPerson} label="Updated By" value={vm.updatedBy || '--'} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <DetailItem icon={MdEvent} label="Updated At" value={safeParseDate(vm.updatedAt)} />
                </Grid>
              </Grid>
            </Box>
          </Box>
        </Grid>

        {/* Right column: History Logs */}
        <Grid item xs={12} md={7}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 1 }}>
            <MdHistory style={{ fontSize: '18px' }} />
            VM Request & Management History
          </Typography>

          <Box sx={{ minHeight: '300px', maxHeight: '550px', overflowY: 'auto', pr: 1 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '250px' }}>
                <CircularProgress size={36} />
              </Box>
            ) : history.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '250px', bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', p: 3, textAlign: 'center' }}>
                <MdHistory style={{ fontSize: '48px', color: '#94a3b8', marginBottom: '8px' }} />
                <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 500 }}>
                  No request history found for this VM.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {history.map((log, idx) => {
                  const isCompletion = log.whatDid && (log.whatDid.includes('Completed') || log.whatDid.includes('Complete') || log.whatDid.includes('Transition (Completed)'));
                  const isRejection = log.whatDid && (log.whatDid.includes('Reject') || log.whatDid.includes('Rejected'));
                  const isCreation = log.whatDid && (log.whatDid.includes('Created') || log.whatDid.includes('Create'));
                  
                  let borderLeftColor = '#3b82f6'; // default blue
                  if (isCompletion) borderLeftColor = '#10b981'; // emerald green
                  if (isRejection) borderLeftColor = '#ef4444'; // red
                  if (isCreation) borderLeftColor = '#8b5cf6'; // purple

                  return (
                    <Paper
                      key={idx}
                      elevation={0}
                      sx={{
                        p: 2,
                        bgcolor: '#f8fafc',
                        border: '1px solid #eef2f6',
                        borderLeft: `4px solid ${borderLeftColor}`,
                        borderRadius: '8px'
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                            {log.requestType}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                            Request ID: {log.requestId}
                          </Typography>
                        </Box>
                        <Chip 
                          label={log.whatDid} 
                          size="small" 
                          sx={{ 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            bgcolor: borderLeftColor + '15', 
                            color: borderLeftColor,
                            border: `1px solid ${borderLeftColor}30`
                          }} 
                        />
                      </Box>
                      
                      <Typography variant="body2" sx={{ color: '#334155', mb: 1.5, fontSize: '13px' }}>
                        {log.details}
                      </Typography>
                      
                      <Divider sx={{ mb: 1, opacity: 0.5 }} />
                      
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            Requested By
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569' }}>
                            {log.whoRequested || '--'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                            Performed By / At
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569', display: 'block' }}>
                            {log.whoDid || '--'}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" sx={{ fontSize: '10px' }}>
                            {safeParseDate(log.time)}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>
    </Modal>
  );
};

export default VMHistoryModal;
