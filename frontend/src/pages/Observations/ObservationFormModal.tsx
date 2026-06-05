import React from 'react';
import Modal from '../../components/Modal';
import TextField from '../../components/TextField';
import DatePicker from '../../components/DatePicker';
import { FormControl, InputLabel, MenuItem, Select, Button, Box, IconButton, Tooltip, Typography, Chip, OutlinedInput, FormGroup, FormControlLabel, Checkbox } from '@mui/material';
import { MdEdit as EditIcon } from 'react-icons/md';
import styles from './index.module.scss';

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
  // Get reportsTo options belongs to the selected category
  const selectedCat = (categories || []).find(c => c.name === formData.category);
  const categoryReportsToOptions = selectedCat?.reportsTo 
    ? selectedCat.reportsTo.split(',').map((s: string) => s.trim()).filter(Boolean) 
    : [];
  const canEdit = isEditMode;
  const showEditButton = editingObs && !isEditMode && hasUpdatePrivilege;

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
            <div className={styles.row}>
              <ViewField label="Description" value={formData.description} />
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
              />
            </div>
            
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
