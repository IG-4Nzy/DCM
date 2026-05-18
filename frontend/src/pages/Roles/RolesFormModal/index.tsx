import Modal from '../../../components/Modal'
import TextField from '../../../components/TextField'
import Dropdown from '../../../components/Dropdown'
import { Button, FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import type { UpdateRolePayload } from '../model';
import styles from './index.module.scss';

interface PropType {
    isModalOpen: boolean;
    handleCloseModal: () => void;
    editingRole: UpdateRolePayload | null;
    formName: string;
    setFormName: (value: string) => void;
    formStatus: boolean;
    setFormStatus: (value: boolean) => void;
    formPrivileges: string[];
    setFormPrivileges: (value: string[]) => void;
    availablePrivileges: string[];
    handleSubmit: (e: React.FormEvent) => void;
}

const RoleFormModal = ({ 
    isModalOpen, 
    handleCloseModal, 
    editingRole, 
    formName, 
    setFormName, 
    formStatus, 
    setFormStatus, 
    formPrivileges, 
    setFormPrivileges, 
    availablePrivileges,
    handleSubmit 
}:PropType) => {
    const formattedPrivileges = (availablePrivileges || []).map(priv => ({ label: priv, value: priv }));

    return (
        <Modal
            open={isModalOpen}
            handleClose={handleCloseModal}
            title={editingRole ? "Edit Role" : "Create Role"}
        >
            <form onSubmit={handleSubmit} className={styles.formContainer}>
                <div className={styles.row}>
                    <TextField
                        className={styles.field}
                        fullWidth
                        label="Role Name"
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
                
                <div className={styles.row}>
                    <Dropdown
                        label="Privileges"
                        options={formattedPrivileges}
                        value={formPrivileges}
                        onChange={setFormPrivileges}
                        multiple={true}
                        fullWidth={true}
                    />
                </div>

                <div className={styles.actions}>
                    <Button variant="text" onClick={handleCloseModal}>Cancel</Button>
                    <Button type="submit" variant="contained" color="primary">Save</Button>
                </div>
            </form>
        </Modal>
    )
}

export default RoleFormModal