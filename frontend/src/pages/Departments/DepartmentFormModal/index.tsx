import React from 'react';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import { Box, Button, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import type { UpdateDepartmentPayload } from '../model';
import styles from './index.module.scss';

interface PropType {
  isModalOpen: boolean;
  handleCloseModal: () => void;
  editingDepartment: UpdateDepartmentPayload | null | any;
  formName: string;
  setFormName: (value: string) => void;
  formStatus: boolean;
  setFormStatus: (value: boolean) => void;
  handleSubmit: (e: React.FormEvent) => void;
}

const DepartmentFormModal = ({
  isModalOpen,
  handleCloseModal,
  editingDepartment,
  formName,
  setFormName,
  formStatus,
  setFormStatus,
  handleSubmit
}: PropType) => {
  return (
    <Modal
      open={isModalOpen}
      handleClose={handleCloseModal}
      title={editingDepartment ? "Edit Department" : "Create Department"}
    >
      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={styles.row}>
          <TextField
            className={styles.field}
            fullWidth
            label="Department Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
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

        <div className={styles.actions}>
          <Button variant="text" onClick={handleCloseModal}>Cancel</Button>
          <Button type="submit" variant="contained" color="primary">Save</Button>
        </div>
      </form>
    </Modal>
  );
};

export default DepartmentFormModal;
