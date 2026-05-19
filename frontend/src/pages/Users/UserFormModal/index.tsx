import Modal from '../../../components/Modal'
import TextField from '../../../components/TextField'
import { Box, Button, FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import type { UpdateUserPayload } from '../model';
import DatePicker from '../../../components/DatePicker';
import Dropdown from '../../../components/Dropdown';
import styles from './index.module.scss';

interface PropType {
    isModalOpen: boolean;
    handleCloseModal: () => void;
    editingUser: UpdateUserPayload | null;
    setFormUsername: (value: string) => void;
    formUsername: string;
    formPassword: string;
    setFormPassword: (value: string) => void;
    setFormRole: (value: string) => void;
    formRole: string;
    formStatus: boolean;
    setFormStatus: (value: boolean) => void;
    availableRoles: { id: string; name: string }[];
    handleSubmit: (e: React.FormEvent) => void;
    formFirstName: string;
    setFormFirstName: (v: string) => void;
    formLastName: string;
    setFormLastName: (v: string) => void;
    formDob: string;
    setFormDob: (v: string) => void;
    formMobile: string;
    setFormMobile: (v: string) => void;
    formBloodGroup: string;
    setFormBloodGroup: (v: string) => void;
    formAddress: string;
    setFormAddress: (v: string) => void;
    formDateOfJoin: string;
    setFormDateOfJoin: (v: string) => void;
    formDepartment: string;
    setFormDepartment: (v: string) => void;
    availableDepartments: any[];
}

const BLOOD_GROUPS = [
    { label: "A+", value: "A+" },
    { label: "A-", value: "A-" },
    { label: "B+", value: "B+" },
    { label: "B-", value: "B-" },
    { label: "O+", value: "O+" },
    { label: "O-", value: "O-" },
    { label: "AB+", value: "AB+" },
    { label: "AB-", value: "AB-" }
];

const UserFormModal = ({ 
    isModalOpen, handleCloseModal, editingUser, 
    setFormUsername, formUsername, 
    formPassword, setFormPassword, 
    setFormRole, formRole, 
    formStatus, setFormStatus, 
    availableRoles, handleSubmit,
    formFirstName, setFormFirstName,
    formLastName, setFormLastName,
    formDob, setFormDob,
    formMobile, setFormMobile,
    formBloodGroup, setFormBloodGroup,
    formAddress, setFormAddress,
    formDateOfJoin, setFormDateOfJoin,
    formDepartment, setFormDepartment,
    availableDepartments
}:PropType) => {
    return (
        <Modal
            open={isModalOpen}
            handleClose={handleCloseModal}
            title={editingUser ? "Edit User" : "Create User"}
        >
            <form onSubmit={handleSubmit} className={styles.formContainer}>
                <div className={styles.row}>
                    <TextField
                        className={styles.field}
                        fullWidth
                        label="Username"
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        required
                    />
                    <TextField
                        className={styles.field}
                        fullWidth
                        label="Password"
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        required={!editingUser}
                        helperText={editingUser ? "Leave blank to keep existing password" : ""}
                        sx={{
                            '& .MuiFormHelperText-root': {
                                color: '#637381'
                            }
                        }}
                    />
                </div>
                
                <div className={styles.row}>
                    <FormControl fullWidth className={styles.field}>
                        <InputLabel>Role</InputLabel>
                        <Select
                            value={formRole}
                            label="Role"
                            onChange={(e) => setFormRole(e.target.value as string)}
                            sx={{ borderRadius: '8px' }}
                        >
                            {(availableRoles || []).map((role) => (
                                <MenuItem key={role.id} value={role.name}>{role.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
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
                        label="First Name"
                        value={formFirstName}
                        onChange={(e) => setFormFirstName(e.target.value)}
                    />
                    <TextField
                        className={styles.field}
                        fullWidth
                        label="Last Name"
                        value={formLastName}
                        onChange={(e) => setFormLastName(e.target.value)}
                    />
                </div>

                <div className={styles.row}>
                    <DatePicker
                        className={styles.field}
                        fullWidth
                        label="Date of Birth"
                        value={formDob}
                        onChange={setFormDob}
                    />
                    <TextField
                        className={styles.field}
                        fullWidth
                        label="Mobile Number"
                        value={formMobile}
                        onChange={(e) => setFormMobile(e.target.value)}
                    />
                </div>

                <div className={styles.row}>
                    <Dropdown
                        className={styles.field}
                        fullWidth
                        label="Blood Group"
                        options={BLOOD_GROUPS}
                        value={formBloodGroup}
                        onChange={setFormBloodGroup}
                        clearable
                    />
                    <Dropdown
                        className={styles.field}
                        fullWidth
                        label="Department"
                        options={(availableDepartments || []).map(d => ({ label: d.name, value: d.name }))}
                        value={formDepartment}
                        onChange={setFormDepartment}
                        clearable
                    />
                </div>
                
                <div className={styles.row}>
                    <TextField
                        className={styles.field}
                        fullWidth
                        label="Address"
                        value={formAddress}
                        onChange={(e) => setFormAddress(e.target.value)}
                        multiline
                        maxRows={3}
                    />
                    <DatePicker
                        className={styles.field}
                        fullWidth
                        label="Date of Join"
                        value={formDateOfJoin}
                        onChange={setFormDateOfJoin}
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

export default UserFormModal