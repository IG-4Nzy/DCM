// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { updateObservation } from './action';
import Modal from '../../components/Modal';
import TextField from '../../components/TextField';
import DatePicker from '../../components/DatePicker';
import { FormControl, InputLabel, MenuItem, Select, Button, Box, IconButton, Tooltip, Typography, Chip, OutlinedInput, FormGroup, FormControlLabel, Checkbox, Avatar, Autocomplete, TextField as MuiTextField, Switch } from '@mui/material';
import { MdEdit as EditIcon, MdSend, MdAttachFile } from 'react-icons/md';
import styles from './index.module.scss';
import request, { API_BASE_URL } from '../../services/request';
import { getServerTime } from '../../helpers/time';
import { getTodayString, validators } from '../../helpers/validation';
import { ROUTE_CONSTANTS } from '../../router/constant';

interface ObservationFormModalProps {
  isModalOpen: boolean;
  handleCloseModal: () => void;
  editingObs: any;
  isEditMode: boolean;
  setIsEditMode: (val: boolean) => void;
  hasUpdatePrivilege: boolean;
  hasCreatePrivilege: boolean;
  formData: any;
  setFormData: (val: any) => void;
  showOther: boolean;
  setShowOther: (val: boolean) => void;
  categoryOptions: { value: string; label: string }[];
  informedToOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  categories: any[];
  handleSubmit: (e: React.FormEvent) => void;
}

const ViewField = ({ label, value }: { label: string, value: any }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, p: 1, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1, border: '1px solid rgba(0,0,0,0.05)' }}>
    <Typography variant="caption" color="textSecondary">{label}</Typography>
    <Typography variant="body1" sx={{ mt: 0.5, wordBreak: 'break-word' }}>{value || '-'}</Typography>
  </Box>
);

const ObservationFormModal: React.FC<ObservationFormModalProps> = ({
  isModalOpen,
  handleCloseModal,
  editingObs,
  isEditMode,
  setIsEditMode,
  hasUpdatePrivilege,
  hasCreatePrivilege,
  formData,
  setFormData,
  showOther,
  setShowOther,
  categoryOptions,
  informedToOptions,
  statusOptions,
  categories,
  handleSubmit
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [newComment, setNewComment] = useState("");
  const currentUser = useSelector((state: RootState) => (state?.auth as any)?.user?.username || state?.auth?.username) || "User";
  const users = useSelector((state: RootState) => state?.users?.users || []);
  const [allObservations, setAllObservations] = useState<any[]>([]);
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [racks, setRacks] = useState<any[]>([]);

  useEffect(() => {
    if (isModalOpen) {
      request.get('/api/observations/', { params: { pagination: false } })
        .then(res => {
          const list = res.data.data || [];
          const currentId = editingObs?._id || editingObs?.id;
          setAllObservations(list.filter((o: any) => (o._id || o.id) !== currentId));
        })
        .catch(err => console.error('Failed to fetch observations for repeat dropdown', err));
      
      request.get('/api/server-racks/', { params: { pagination: false } })
        .then(res => setRacks(res.data.data || []))
        .catch(err => console.error('Failed to fetch server racks for dropdown', err));
    }
  }, [isModalOpen, editingObs]);

  const selectedObservationObj = allObservations.find(
    (obs: any) => (obs._id || obs.id) === formData.repeatedFromId
  ) || null;

  // Get reportsTo options belongs to the selected category
  const selectedCat = (categories || []).find(c => c.name === formData.category);
  const categoryReportsToOptions = selectedCat?.reportsTo 
    ? selectedCat.reportsTo.split(',').map((s: string) => s.trim()).filter(Boolean) 
    : [];
  const isSuperuser = useSelector((state: RootState) => (state?.auth as any)?.isSuperuser || (state?.auth as any)?.user?.isSuperuser);
  const canEdit = isEditMode;
  const isResolved = editingObs?.status === 'Resolved';
  const showEditButton = editingObs && !isEditMode && hasUpdatePrivilege && (!isResolved || isSuperuser);

  const handleAddComment = async () => {
    if ((!newComment.trim() && !commentFile) || !editingObs || isUploading) return;

    setIsUploading(true);
    let uploadedFileDetails = null;

    if (commentFile) {
      const fd = new FormData();
      fd.append('files', commentFile);
      try {
        const res = await request.post('/api/observations/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data && res.data.length > 0) {
          uploadedFileDetails = res.data[0];
        }
      } catch (err) {
        console.error("Upload failed", err);
        setIsUploading(false);
        return;
      }
    }

    const newCommentObj: any = {
      text: newComment.trim(),
      user: currentUser,
      timestamp: getServerTime().toDate().toISOString()
    };

    if (uploadedFileDetails) {
      newCommentObj.attachment = uploadedFileDetails;
    }

    const updatedComments = [...(formData.comments || []), newCommentObj];
    try {
      const id = editingObs._id || editingObs.id;
      const res = await dispatch(updateObservation({
        id,
        data: {
          comments: updatedComments
        }
      })).unwrap();
      setFormData((prev: any) => ({ ...prev, comments: res.comments }));
      setNewComment("");
      setCommentFile(null);
    } catch (err) {
      console.error("Failed to add comment", err);
    } finally {
      setIsUploading(false);
    }
  };

  const headerTitle = (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
      <Typography variant="h6">{editingObs ? "Observation Details" : "Add Observation"}</Typography>
      {showEditButton && (
        <Tooltip title="Edit Observation">
          <IconButton size="small" color="primary" onClick={() => setIsEditMode(true)}>
            <EditIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );

  return (
    <Modal
      open={isModalOpen}
      handleClose={handleCloseModal}
      title={headerTitle as any}
    >
      <form onSubmit={handleSubmit} className={styles.formContainer}>
        
        {!canEdit ? (
          <>
            <div className={styles.row}>
              <ViewField label="Observed Date" value={formData.observedDate} />
              <ViewField label="Observed Time" value={formData.observedTime} />
            </div>
            <div className={styles.row}>
              <ViewField label="Category" value={formData.category} />
              <ViewField label="AMC" value={formData.amc} />
            </div>
            {formData.category?.toLowerCase() === 'hard disk failures' && (
              <div className={styles.row}>
                <ViewField label="Server Rack" value={formData.serverRack} />
                <ViewField label="Rack Position" value={formData.rackPosition} />
              </div>
            )}
            <div className={styles.row}>
              <ViewField label="Description" value={formData.description} />
            </div>
            <div className={styles.row}>
              <ViewField label="Actions Taken" value={formData.actionsTaken} />
            </div>
            <div className={styles.row}>
              <FormControl component="fieldset" fullWidth sx={{ p: 1.5, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1.5, border: '1px solid rgba(0,0,0,0.05)' }}>
                <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', mb: 1.5, letterSpacing: '0.5px' }}>
                  Reports To / Escalation Status
                </Typography>
                {categoryReportsToOptions.length === 0 ? (
                  <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                    No reports to options are configured for the selected category.
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {categoryReportsToOptions.map((opt) => {
                      const isReported = (formData.informedTo || []).includes(opt);
                      return (
                        <Box key={opt} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, px: 2, bgcolor: '#ffffff', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>{opt}</Typography>
                          <Chip
                            label={isReported ? 'Reported' : 'Not Reported'}
                            size="small"
                            sx={{ 
                              fontWeight: 'bold', 
                              fontSize: '0.75rem',
                              bgcolor: isReported ? '#e8f5e9' : '#ffebee',
                              color: isReported ? '#2e7d32' : '#c62828',
                              border: isReported ? '1px solid #c8e6c9' : '1px solid #ffcdd2'
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </FormControl>
            </div>
            <div className={styles.row}>
              <ViewField label="Status" value={formData.status} />
              {formData.status === 'Resolved' && <ViewField label="Remarks" value={formData.remarks} />}
            </div>
            
            {formData.isIncident && (
              <Box sx={{ mt: 1, mb: 1, p: 1.5, bgcolor: '#ffebee', borderRadius: 2, border: '1px solid #ef9a9a', width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label="🚨 INCIDENT" color="error" size="small" sx={{ fontWeight: 'bold' }} />
                <Typography variant="body2" color="error.dark" sx={{ fontWeight: 500 }}>
                  This observation has been marked as a high-priority incident.
                </Typography>
              </Box>
            )}
            {(formData.isRepeated || (editingObs?.repeatCount && editingObs.repeatCount > 0)) && (
              <Box sx={{ mt: 1, mb: 1, p: 2, bgcolor: '#e3f2fd', borderRadius: 2, border: '1px solid #90caf9', width: '100%' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1565c0', mb: 1 }}>
                  Repeated Issue Information
                </Typography>
                
                {formData.isRepeated && editingObs?.repeatedDetails?.parent && (
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="body2" color="textSecondary">
                      This observation is repeated from:
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                      {editingObs.repeatedDetails.parent.observationId} - {editingObs.repeatedDetails.parent.description} ({editingObs.repeatedDetails.parent.observedDate})
                    </Typography>
                  </Box>
                )}
                
                {editingObs?.repeatedDetails?.children && editingObs.repeatedDetails.children.length > 0 && (
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Repeated occurrences of this issue ({editingObs.repeatedDetails.children.length}):
                    </Typography>
                    <ul style={{ margin: 0, paddingLeft: '20px', marginTop: '4px' }}>
                      {editingObs.repeatedDetails.children.map((child: any) => (
                        <li key={child.id}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {child.observationId} - {child.description} ({child.observedDate})
                          </Typography>
                        </li>
                      ))}
                    </ul>
                  </Box>
                )}
              </Box>
            )}
            {editingObs?.mappedWorks && editingObs.mappedWorks.length > 0 && (
              <Box sx={{ mt: 1, mb: 1, p: 2, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0', width: '100%' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#166534', mb: 1 }}>
                  Linked Work Tickets ({editingObs.mappedWorks.length})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {editingObs.mappedWorks.map((work: any) => (
                    <Box 
                      key={work.id}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('openWorkDetailModal', { detail: { workId: work.workId || work.id } }));
                      }}
                      sx={{
                        p: 1.5,
                        bgcolor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #dcfce7',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          borderColor: '#22c55e'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Chip label={work.workId || 'Work'} size="small" color="primary" sx={{ fontWeight: 'bold' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {work.workName}
                        </Typography>
                      </Box>
                      <Chip 
                        label={work.status} 
                        size="small" 
                        variant="outlined" 
                        sx={{ 
                          fontWeight: 'bold',
                          color: work.status === 'Completed' ? '#166534' : '#1e40af',
                          borderColor: work.status === 'Completed' ? '#bbf7d0' : '#bfdbfe'
                        }} 
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </>
        ) : (
          <>
            <div className={styles.row}>
              <DatePicker
                className={styles.field}
                fullWidth
                label="Observed Date"
                value={formData.observedDate}
                onChange={(e: any) => setFormData({ ...formData, observedDate: e })}
                required
                maxDate={getTodayString()}
              />
              <TextField
                className={styles.field}
                fullWidth
                label="Observed Time"
                type="time"
                value={formData.observedTime}
                onChange={(e: any) => setFormData({ ...formData, observedTime: e.target.value })}
                required
                InputLabelProps={{ shrink: true }}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </div>
            
            <div className={styles.row}>
              <FormControl fullWidth className={styles.field}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  label="Category"
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  sx={{ borderRadius: '8px' }}
                  required
                >
                  {categoryOptions.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth className={styles.field}>
                <InputLabel id="amc-label">AMC</InputLabel>
                <Select
                  labelId="amc-label"
                  value={formData.amc || ""}
                  label="AMC"
                  onChange={(e) => setFormData({ ...formData, amc: e.target.value })}
                  sx={{ borderRadius: '8px' }}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  <MenuItem value="Yes">Yes</MenuItem>
                  <MenuItem value="No">No</MenuItem>
                </Select>
              </FormControl>
            </div>
            
            {formData.category?.toLowerCase() === 'hard disk failures' && (
              <div className={styles.row}>
                <FormControl fullWidth className={styles.field}>
                  <InputLabel>Server Rack</InputLabel>
                  <Select
                    value={formData.serverRack || ""}
                    label="Server Rack"
                    onChange={(e) => setFormData({ ...formData, serverRack: e.target.value })}
                    sx={{ borderRadius: '8px' }}
                    required
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {racks.map(r => (
                      <MenuItem key={r._id || r.id} value={r.serverRack}>{r.serverRack}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <TextField
                  className={styles.field}
                  fullWidth
                  label="Rack Position"
                  value={formData.rackPosition || ""}
                  onChange={(e: any) => setFormData({ ...formData, rackPosition: e.target.value })}
                  placeholder="Enter rack position"
                  required
                />
              </div>
            )}
            
            <div className={styles.row}>
              <TextField
                className={styles.field}
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
                required
                multiline
                rows={3}
                showCount={true}
                inputProps={{ maxLength: 1500 }}
              />
            </div>
            
            <div className={styles.row}>
              <TextField
                className={styles.field}
                fullWidth
                label="Actions Taken"
                value={formData.actionsTaken || ""}
                onChange={(e: any) => setFormData({ ...formData, actionsTaken: e.target.value })}
                placeholder="Enter actions taken"
                multiline
                rows={3}
                showCount={true}
                inputProps={{ maxLength: 220 }}
              />
            </div>
            
            <div className={styles.row} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', width: '100%', paddingLeft: '8px', paddingRight: '8px' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isRepeated || false}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      isRepeated: e.target.checked,
                      repeatedFromId: e.target.checked ? formData.repeatedFromId : '' 
                    })}
                    color="primary"
                  />
                }
                label="Repeated Issue"
              />
              {formData.isRepeated && (
                <Autocomplete
                  fullWidth
                  sx={{ mt: 1 }}
                  options={allObservations}
                  getOptionLabel={(obs: any) => 
                    obs ? `${obs.observationId} - ${obs.description.substring(0, 50)}${obs.description.length > 50 ? '...' : ''} (${obs.observedDate})` : ''
                  }
                  value={selectedObservationObj}
                  onChange={(event, newValue: any) => {
                    setFormData({
                      ...formData,
                      repeatedFromId: newValue ? (newValue._id || newValue.id) : ''
                    });
                  }}
                  filterOptions={(options, state) => {
                    const query = state.inputValue.trim();
                    if (query === '') {
                      return [];
                    }
                    const selectedLabel = selectedObservationObj 
                      ? `${selectedObservationObj.observationId} - ${selectedObservationObj.description.substring(0, 50)}${selectedObservationObj.description.length > 50 ? '...' : ''} (${selectedObservationObj.observedDate})`
                      : '';
                    if (query === selectedLabel) {
                      return selectedObservationObj ? [selectedObservationObj] : [];
                    }
                    const lowerQuery = query.toLowerCase();
                    return options.filter((obs: any) => 
                      (obs.observationId || '').toLowerCase().includes(lowerQuery) ||
                      (obs.description || '').toLowerCase().includes(lowerQuery) ||
                      (obs.observedDate || '').includes(lowerQuery)
                    );
                  }}
                  noOptionsText={allObservations.length === 0 ? 'No other observations available' : 'Type to search observations...'}
                  renderInput={(params) => (
                    <MuiTextField
                      {...params}
                      label="Choose Repeated Observation"
                      required
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                        }
                      }}
                    />
                  )}
                />
              )}
            </div>

            {!editingObs && (
              <div className={styles.row} style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1.5, 
                  p: 1.5, 
                  borderRadius: 2, 
                  border: formData.isIncident ? '2px solid #d32f2f' : '1px solid rgba(0,0,0,0.12)', 
                  bgcolor: formData.isIncident ? '#ffebee' : 'transparent',
                  transition: 'all 0.2s ease',
                  width: '100%'
                }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isIncident || false}
                        onChange={(e) => setFormData({ ...formData, isIncident: e.target.checked })}
                        color="error"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: formData.isIncident ? 'bold' : 'normal', color: formData.isIncident ? '#d32f2f' : 'inherit' }}>
                          {formData.isIncident ? '🚨 Marked as Incident' : 'Mark as Incident'}
                        </Typography>
                      </Box>
                    }
                  />
                  {formData.isIncident && (
                    <Typography variant="caption" color="error" sx={{ ml: 'auto' }}>
                      Incident email will be sent on creation
                    </Typography>
                  )}
                </Box>
              </div>
            )}
            
            <div className={styles.row} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <FormControl component="fieldset" fullWidth sx={{ mt: 1 }}>
                <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Reports To / Informed To
                </Typography>
                {!formData.category ? (
                  <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                    Please select a Category first to view its escalation list.
                  </Typography>
                ) : categoryReportsToOptions.length === 0 ? (
                  <Typography variant="body2" color="error" sx={{ fontStyle: 'italic' }}>
                    No reports to options are configured for the selected category.
                  </Typography>
                ) : (
                  <FormGroup row sx={{ gap: 2 }}>
                    {categoryReportsToOptions.map((opt) => {
                      const isChecked = formData.informedTo.includes(opt);
                      return (
                        <FormControlLabel
                          key={opt}
                          control={
                            <Checkbox
                              checked={isChecked}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const updatedInformedTo = checked
                                  ? [...formData.informedTo, opt]
                                  : formData.informedTo.filter((val: string) => val !== opt);
                                setFormData({ ...formData, informedTo: updatedInformedTo });
                              }}
                              color="primary"
                            />
                          }
                          label={opt}
                        />
                      );
                    })}
                  </FormGroup>
                )}
              </FormControl>
            </div>

            {editingObs && (
              <div className={styles.row}>
                <FormControl fullWidth className={styles.field}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    sx={{ borderRadius: '8px' }}
                    required
                  >
                    {statusOptions.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
            )}

            {formData.status === 'Resolved' && (
              <div className={styles.row}>
                <TextField
                  className={styles.field}
                  fullWidth
                  label="Remarks"
                  value={formData.remarks}
                  onChange={(e: any) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Enter remarks (Mandatory for resolved observations)"
                  required
                  multiline
                  rows={2}
                />
              </div>
            )}
          </>
        )}

        {editingObs && (
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(0,0,0,0.08)', width: '100%' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }}>
              Comments
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2, maxHeight: '200px', overflowY: 'auto', pr: 1 }}>
              {formData.comments && formData.comments.length > 0 ? (
                [...formData.comments].reverse().map((comment: any, index: number) => {
                  const uObj = users.find((u: any) => u.username === comment.user);
                  const fullName = uObj ? `${uObj.firstName || ""} ${uObj.lastName || ""}`.trim() || comment.user : comment.user;
                  const avatarLetter = (fullName || "?")[0].toUpperCase();
                  return (
                    <Box key={index} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: '#1976d2', fontSize: '0.85rem' }}>
                        {avatarLetter}
                      </Avatar>
                      <Box sx={{ flex: 1, bgcolor: 'rgba(0,0,0,0.02)', p: 1, borderRadius: 1.5, border: '1px solid rgba(0,0,0,0.04)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>{fullName}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {new Date(comment.timestamp).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{comment.text}</Typography>
                        {comment.attachment && (
                          <Chip
                            icon={<MdAttachFile />}
                            label={comment.attachment.name || "Attachment"}
                            size="small"
                            onClick={() => window.open(`${API_BASE_URL}${comment.attachment.url}`, "_blank")}
                            sx={{ mt: 1, backgroundColor: 'rgba(0,0,0,0.05)', cursor: 'pointer' }}
                          />
                        )}
                      </Box>
                    </Box>
                  );
                })
              ) : (
                <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 1 }}>
                  No comments yet.
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {commentFile && (
                <Box sx={{ display: 'flex' }}>
                  <Chip 
                    label={commentFile.name} 
                    onDelete={() => setCommentFile(null)} 
                    size="small" 
                    color="primary" 
                    variant="outlined" 
                  />
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <IconButton
                  component="label"
                  disabled={isUploading}
                  sx={{ minWidth: '40px', width: '40px', height: '40px', borderRadius: '50%', color: '#637381' }}
                >
                  <MdAttachFile size={20} />
                  <input
                    type="file"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setCommentFile(e.target.files[0]);
                      }
                      e.target.value = '';
                    }}
                  />
                </IconButton>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  maxRows={4}
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e: any) => setNewComment(e.target.value)}
                  onKeyDown={(e: any) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                  disabled={isUploading}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
                />
                <IconButton 
                  color="primary" 
                  onClick={handleAddComment}
                  disabled={(!newComment.trim() && !commentFile) || isUploading}
                  sx={{ bgcolor: 'rgba(25, 118, 210, 0.04)', borderRadius: '50%', width: 40, height: 40 }}
                >
                  <MdSend size={18} />
                </IconButton>
              </Box>
            </Box>
          </Box>
        )}

        <div className={styles.actions}>
          {canEdit ? (
            <>
              <Button variant="text" onClick={handleCloseModal} type="button">Cancel</Button>
              <Button type="submit" variant="contained" color="primary">{editingObs ? "Save Changes" : "Submit"}</Button>
            </>
          ) : (
            <Button variant="text" onClick={handleCloseModal} type="button">Close</Button>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default ObservationFormModal;
