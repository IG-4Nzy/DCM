import React from 'react';
import Modal from '../../components/Modal';
import TextField from '../../components/TextField';
import DatePicker from '../../components/DatePicker';
import { FormControl, InputLabel, MenuItem, Select, Button, Box, IconButton, Tooltip, Typography, Chip, OutlinedInput } from '@mui/material';
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
  handleSubmit
}) => {
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
              <ViewField label="Informed To" value={
                (formData.informedTo || []).map((i: string) => i === 'Other' ? formData.informedToOther : (informedToOptions.find(o => o.value === i)?.label || i)).join(', ')
              } />
            </div>
            <div className={styles.row}>
              <ViewField label="Status" value={formData.status} />
              {formData.status === 'Closed' && <ViewField label="Remarks" value={formData.remarks} />}
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
              
              <TextField
                className={styles.field}
                fullWidth
                label="AMC"
                value={formData.amc}
                onChange={(e: any) => setFormData({ ...formData, amc: e.target.value })}
                placeholder="Enter AMC"
                required
              />
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
            
            <div className={styles.row}>
              <FormControl fullWidth className={styles.field}>
                <InputLabel>Informed To</InputLabel>
                <Select
                  multiple
                  value={formData.informedTo}
                  onChange={(e) => {
                    const val = e.target.value as string[];
                    setFormData({ ...formData, informedTo: val });
                    setShowOther(val.includes('Other'));
                  }}
                  input={<OutlinedInput label="Informed To" sx={{ borderRadius: '8px' }} />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={informedToOptions.find(o => o.value === value)?.label || value} size="small" />
                      ))}
                    </Box>
                  )}
                  required
                >
                  {informedToOptions.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {showOther && (
                <TextField
                  className={styles.field}
                  fullWidth
                  label="Specify Other"
                  value={formData.informedToOther}
                  onChange={(e: any) => setFormData({ ...formData, informedToOther: e.target.value })}
                  placeholder="Enter name"
                  required
                />
              )}
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

            {formData.status === 'Closed' && (
              <div className={styles.row}>
                <TextField
                  className={styles.field}
                  fullWidth
                  label="Remarks"
                  value={formData.remarks}
                  onChange={(e: any) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Enter remarks (Mandatory for closed observations)"
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
