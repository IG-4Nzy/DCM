// @ts-nocheck
import React from 'react';
import Modal from '../../components/Modal';
import TextField from '../../components/TextField';
import { FormControl, InputLabel, MenuItem, Select, Button, Box, Chip, OutlinedInput } from '@mui/material';
import styles from './index.module.scss';

interface CategoryFormModalProps {
  isModalOpen: boolean;
  handleCloseModal: () => void;
  editingCategory: any;
  formName: string;
  setFormName: (val: string) => void;
  formStatus: boolean;
  setFormStatus: (val: boolean) => void;
  formReportsTo: string[];
  setFormReportsTo: (val: string[]) => void;
  reportsToOptions: { value: string; label: string }[];
  formRemarks: string;
  setFormRemarks: (val: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
}

const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  isModalOpen,
  handleCloseModal,
  editingCategory,
  formName,
  setFormName,
  formStatus,
  setFormStatus,
  formReportsTo,
  setFormReportsTo,
  reportsToOptions,
  formRemarks,
  setFormRemarks,
  handleSubmit
}) => {
  return (
    <Modal
      open={isModalOpen}
      handleClose={handleCloseModal}
      title={editingCategory ? "Edit Category" : "Add Category"}
    >
      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={styles.row}>
          <TextField
            className={styles.field}
            fullWidth
            label="Category Name"
            value={formName}
            onChange={(e: any) => setFormName(e.target.value)}
            placeholder="Enter category name"
            required
          />
          <FormControl fullWidth className={styles.field}>
            <InputLabel>Status</InputLabel>
            <Select
              value={formStatus ? "true" : "false"}
              label="Status"
              onChange={(e) => setFormStatus(e.target.value === "true")}
              sx={{ borderRadius: '8px' }}
            >
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Inactive</MenuItem>
            </Select>
          </FormControl>
        </div>
        
        <div className={styles.row}>
          <FormControl fullWidth className={styles.field}>
            <InputLabel id="reports-to-label">Reports To</InputLabel>
            <Select
              labelId="reports-to-label"
              multiple
              value={formReportsTo}
              onChange={(e) => setFormReportsTo(e.target.value as string[])}
              input={<OutlinedInput label="Reports To" sx={{ borderRadius: '8px' }} />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((val) => (
                    <Chip key={val} label={reportsToOptions.find(opt => opt.value === val)?.label || val} size="small" />
                  ))}
                </Box>
              )}
            >
              {reportsToOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            className={styles.field}
            fullWidth
            label="Remarks"
            value={formRemarks}
            onChange={(e: any) => setFormRemarks(e.target.value)}
            placeholder="Enter remarks"
          />
        </div>

        <div className={styles.actions}>
          <Button variant="text" onClick={handleCloseModal} type="button">
            Cancel
          </Button>
          <Button type="submit" variant="contained" color="primary">
            {editingCategory ? "Update" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CategoryFormModal;
