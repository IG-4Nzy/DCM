import React from 'react';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import { Button, FormControl, InputLabel, MenuItem, Select, Box, Typography, Tooltip, IconButton, FormControlLabel, Checkbox } from '@mui/material';
import type { UpdateUserPayload } from '../model';
import DatePicker from '../../../components/DatePicker';
import Dropdown from '../../../components/Dropdown';
import { MdEdit as EditIcon } from 'react-icons/md';
import styles from './index.module.scss';

interface PropType {
    isModalOpen: boolean;
    handleCloseModal: () => void;
    editingUser: UpdateUserPayload | null;
    isEditMode: boolean;
    setIsEditMode: (val: boolean) => void;
    hasUpdatePrivilege: boolean;
    setFormUsername: (value: string) => void;
    formUsername: string;
    formPassword: string;
    setFormPassword: (value: string) => void;
    setFormRole: (value: string | string[]) => void;
    formRole: string | string[];
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
    formIsDepartmentHead: boolean;
    setFormIsDepartmentHead: (v: boolean) => void;
    availableDepartments: any[];
    formReplacementFor: string;
    setFormReplacementFor: (v: string) => void;
    inactiveUsers: any[];
    onViewReplacedUser?: (id: string) => void;
    formPassNumber: string;
    setFormPassNumber: (v: string) => void;
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

const ViewField = ({ label, value }: { label: string, value: any }) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, p: 1, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1, border: '1px solid rgba(0,0,0,0.05)' }}>
         <Typography variant="caption" color="textSecondary">{label}</Typography>
         <Typography variant="body1" sx={{ mt: 0.5, wordBreak: 'break-word' }}>{value || '-'}</Typography>
     </Box>
 );
 
 const UserFormModal = ({ 
     isModalOpen, handleCloseModal, editingUser, 
     isEditMode, setIsEditMode, hasUpdatePrivilege,
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
     formIsDepartmentHead, setFormIsDepartmentHead,
     availableDepartments,
     formReplacementFor, setFormReplacementFor,
     inactiveUsers, onViewReplacedUser,
     formPassNumber, setFormPassNumber
 }: PropType) => {
     
     const canEdit = isEditMode;
     const showEditButton = editingUser && !isEditMode && hasUpdatePrivilege;
 
     const headerTitle = (
         <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
           <Typography variant="h6">{editingUser ? "User Details" : "Create User"}</Typography>
           {showEditButton && (
             <Tooltip title="Edit User">
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
                             <ViewField label="Username" value={formUsername} />
                             <ViewField label="Role" value={Array.isArray(formRole) ? formRole.join(", ") : formRole} />
                         </div>
                         <div className={styles.row}>
                             <ViewField label="Status" value={formStatus ? "Active" : "Inactive"} />
                             <ViewField label="Department" value={formDepartment} />
                         </div>
                         <div className={styles.row}>
                             <ViewField label="Is Department Head" value={formIsDepartmentHead ? "Yes" : "No"} />
                             <ViewField label="Pass Number" value={formPassNumber} />
                         </div>
                        {editingUser?.replacementFor && (
                            <div className={styles.row}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, p: 1, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1, border: '1px solid rgba(0,0,0,0.05)' }}>
                                    <Typography variant="caption" color="textSecondary">Replacement For (Relieved User)</Typography>
                                    <Typography 
                                        variant="body1" 
                                        sx={{ 
                                            mt: 0.5, 
                                            color: '#1976d2', 
                                            textDecoration: 'underline', 
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            '&:hover': { color: '#115293' }
                                        }}
                                        onClick={() => onViewReplacedUser && onViewReplacedUser(editingUser.replacementFor!)}
                                    >
                                        {editingUser.replacementForName || 'View Details'}
                                    </Typography>
                                </Box>
                            </div>
                        )}
                        <div className={styles.row}>
                            <ViewField label="First Name" value={formFirstName} />
                            <ViewField label="Last Name" value={formLastName} />
                        </div>
                        <div className={styles.row}>
                            <ViewField label="Date of Birth" value={formDob} />
                            <ViewField label="Blood Group" value={formBloodGroup} />
                        </div>
                        <div className={styles.row}>
                            <ViewField label="Mobile Number" value={formMobile} />
                            <ViewField label="Date of Join" value={formDateOfJoin} />
                        </div>
                        <div className={styles.row}>
                            <ViewField label="Address" value={formAddress} />
                        </div>
                    </>
                ) : (
                    <>
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
                                <InputLabel>Role(s)</InputLabel>
                                <Select
                                    multiple
                                    value={Array.isArray(formRole) ? formRole : (formRole ? [formRole] : [])}
                                    label="Role(s)"
                                    onChange={(e) => setFormRole(e.target.value as string[])}
                                    renderValue={(selected) => (selected as string[]).join(', ')}
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
                                onChange={(val) => {
                                    setFormDepartment(val);
                                    if (!val) {
                                        setFormIsDepartmentHead(false);
                                    }
                                }}
                                clearable
                            />
                        </div>
                        
                        {formDepartment && (
                            <div className={styles.row} style={{ marginTop: '-8px', marginBottom: '8px' }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={formIsDepartmentHead}
                                            onChange={(e) => setFormIsDepartmentHead(e.target.checked)}
                                            color="primary"
                                        />
                                    }
                                    label="Is Department Head"
                                    sx={{ ml: 0.5 }}
                                />
                            </div>
                        )}
                        
                        <div className={styles.row}>
                            <FormControl fullWidth className={styles.field}>
                                <InputLabel>Replacement For (Relieved User)</InputLabel>
                                <Select
                                    value={formReplacementFor || ""}
                                    label="Replacement For (Relieved User)"
                                    onChange={(e) => setFormReplacementFor(e.target.value)}
                                    sx={{ borderRadius: '8px' }}
                                >
                                    <MenuItem value=""><em>None</em></MenuItem>
                                    {(inactiveUsers || []).map((u: any) => (
                                        <MenuItem key={u.id} value={u.id}>
                                            {u.username} {u.firstName || u.lastName ? `(${u.firstName || ''} ${u.lastName || ''})`.trim() : ''}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField
                                className={styles.field}
                                fullWidth
                                label="Pass Number"
                                value={formPassNumber}
                                onChange={(e) => setFormPassNumber(e.target.value)}
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
                    </>
                )}

                <div className={styles.actions}>
                    {canEdit ? (
                        <>
                            <Button variant="text" onClick={handleCloseModal}>Cancel</Button>
                            <Button type="submit" variant="contained" color="primary">Save</Button>
                        </>
                    ) : (
                        <Button variant="text" onClick={handleCloseModal}>Close</Button>
                    )}
                </div>
            </form>
        </Modal>
    )
}

export default UserFormModal