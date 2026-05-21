import React from 'react';
import Modal from '../../components/Modal';
import TextField from '../../components/TextField';
import { FormControl, InputLabel, MenuItem, Select, Button } from '@mui/material';
import styles from './index.module.scss';

interface CategoryFormModalProps {
  isModalOpen: boolean;
  handleCloseModal: () => void;
  editingCategory: any;
  formName: string;
  setFormName: (val: string) => void;
  formStatus: boolean;
  setFormStatus: (val: boolean) => void;
  formReportsTo: string;
  setFormReportsTo: (val: string) => void;
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
          <TextField
            className={styles.field}
            fullWidth
            label="Reports To"
            value={formReportsTo}
            onChange={(e: any) => setFormReportsTo(e.target.value)}
            placeholder="Enter whom this reports to"
          />
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
