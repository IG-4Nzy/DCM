// @ts-nocheck
import React from 'react';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import Dropdown from '../../../components/Dropdown';
import { Button, Autocomplete, TextField as MuiTextField } from '@mui/material';
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
  formDepartmentHead: string;
  setFormDepartmentHead: (value: string) => void;
  usersList: any[];
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
  formDepartmentHead,
  setFormDepartmentHead,
  usersList,
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
          <Dropdown
            label="Status"
            value={formStatus ? "true" : "false"}
            onChange={(val) => setFormStatus(val === "true")}
            options={[
              { label: 'Active', value: 'true' },
              { label: 'Inactive', value: 'false' },
            ]}
            className={styles.field}
          />
        </div>
        <div className={styles.row}>
          <Autocomplete
            className={styles.field}
            options={[
              { label: '-- None --', value: '' },
              ...(usersList || []).map(u => ({
                label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
                value: u.username
              }))
            ]}
            getOptionLabel={(option) => option.label}
            value={
              formDepartmentHead
                ? [
                    { label: '-- None --', value: '' },
                    ...(usersList || []).map(u => ({
                      label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
                      value: u.username
                    }))
                  ].find(opt => opt.value === formDepartmentHead) || { label: '-- None --', value: '' }
                : { label: '-- None --', value: '' }
            }
            onChange={(e, newValue) => {
              setFormDepartmentHead(newValue ? newValue.value : '');
            }}
            renderInput={(params) => (
              <MuiTextField 
                {...params} 
                label="Department Head" 
                variant="outlined" 
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px'
                  }
                }}
              />
            )}
            isOptionEqualToValue={(option, value) => option.value === value.value}
          />
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
