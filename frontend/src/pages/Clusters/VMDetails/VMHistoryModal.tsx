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
  MdHistory 
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
            <Box sx={{ p: 2, bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>
                  {vm.vmId || 'VM Details'}
                </Typography>
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
