// @ts-nocheck
import React from 'react';
import Modal from '../../../components/Modal';
import TextField from '../../../components/TextField';
import { Button, FormControl, InputLabel, MenuItem, Select, Box, Typography, Tooltip, IconButton, FormControlLabel, Checkbox } from '@mui/material';
import type { UpdateUserPayload } from '../model';
import DatePicker from '../../../components/DatePicker';
import Dropdown from '../../../components/Dropdown';
import {
    MdEdit as EditIcon,
    MdOutlineSecurity as SecurityIcon,
    MdOutlinePerson as PersonIcon,
    MdOutlineBadge as BadgeIcon
} from 'react-icons/md';
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

    availableDepartments: any[];
    formReplacementFor: string;
    setFormReplacementFor: (v: string) => void;
    inactiveUsers: any[];
    onViewReplacedUser?: (id: string) => void;
    formPassNumber: string;
    setFormPassNumber: (v: string) => void;
    formIsMonitorUser: boolean;
    setFormIsMonitorUser: (v: boolean) => void;
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

const ViewField = ({ label, value, className = '' }: { label: string, value: any, className?: string }) => (
    <div className={`${styles.viewFieldCard} ${className}`}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value || '-'}</span>
    </div>
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

    availableDepartments,
    formReplacementFor, setFormReplacementFor,
    inactiveUsers, onViewReplacedUser,
    formPassNumber, setFormPassNumber,
    formIsMonitorUser, setFormIsMonitorUser
}: PropType) => {

    const canEdit = isEditMode;
    const showEditButton = editingUser && !isEditMode && hasUpdatePrivilege;

    // Validation helpers
    const validateUsername = (v: string) => {
        if (!v) return "";
        if (!/^[a-zA-Z0-9_]+$/.test(v)) return "Username must contain alphabets, underscore, and numbers only";
        if (v.length > 20) return "Username must be maximum 20 characters";
        return "";
    };

    const validatePassword = (v: string) => {
        if (!v) return "";
        if (v.length > 20) return "Password must be maximum 20 characters";
        return "";
    };

    const validateName = (v: string, label: string) => {
        if (!v) return "";
        if (!/^[a-zA-Z0-9_.\s]+$/.test(v)) return `${label} must contain alphanumeric characters, spaces, dots, or underscores only`;
        if (v.length > 20) return `${label} must be maximum 20 characters`;
        return "";
    };

    const validateMobile = (v: string) => {
        if (!v) return "";
        if (!/^[0-9,]+$/.test(v)) return "Mobile number must contain numbers and commas only";
        return "";
    };

    const validatePassNumber = (v: string) => {
        if (!v) return "";
        if (!/^[a-zA-Z0-9]+$/.test(v)) return "Pass number must contain alphanumeric characters only";
        if (v.length > 20) return "Pass number must be maximum 20 characters";
        return "";
    };

    const validateDateOfJoin = (v: string) => {
        if (!v) return "";
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (new Date(v) > today) return "Date of join cannot be a future date";
        return "";
    };

    const usernameErr = validateUsername(formUsername);
    const passwordErr = validatePassword(formPassword);
    const firstNameErr = validateName(formFirstName, "First name");
    const lastNameErr = validateName(formLastName, "Last name");
    const mobileErr = validateMobile(formMobile);
    const passNumberErr = validatePassNumber(formPassNumber);
    const dateOfJoinErr = validateDateOfJoin(formDateOfJoin);

    const hasFormErrors = !!usernameErr || !!passwordErr || !!firstNameErr || !!lastNameErr || !!mobileErr || !!passNumberErr || !!dateOfJoinErr;

    const getLocalDateString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Get initials for profile avatar
    const getInitials = () => {
        const first = (formFirstName || '').charAt(0).toUpperCase();
        const last = (formLastName || '').charAt(0).toUpperCase();
        return last ? `${first}${last}` : first || (formUsername || '?').charAt(0).toUpperCase();
    };

    const headerTitle = (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
                {editingUser ? (isEditMode ? "Edit User" : "User Details") : "Create User"}
            </Typography>
            {showEditButton && (
                <Tooltip title="Edit User">
                    <IconButton
                        size="small"
                        color="primary"
                        onClick={() => setIsEditMode(true)}
                        sx={{
                            border: '1.5px solid rgba(25, 118, 210, 0.2)',
                            borderRadius: '8px',
                            '&:hover': {
                                backgroundColor: 'rgba(25, 118, 210, 0.08)'
                            }
                        }}
                    >
                        <EditIcon size={18} />
                    </IconButton>
                </Tooltip>
            )}
        </Box>
    );

    return (
        <Modal
            open={isModalOpen}
            handleClose={handleCloseModal}
            title={headerTitle}
            maxWidth="md"
        >
            <form onSubmit={handleSubmit} className={styles.formContainer}>
                {editingUser && !canEdit && (
                    <div className={styles.profileHeader}>
                        <div className={styles.avatar}>{getInitials()}</div>
                        <div className={styles.headerInfo}>
                            <span className={styles.name}>
                                {`${formFirstName || ''} ${formLastName || ''}`.trim() || formUsername}
                            </span>
                            <span className={styles.role}>
                                {(() => {
                                    const roleIds = Array.isArray(formRole) ? formRole : (formRole ? [formRole] : []);
                                    return roleIds.map(rid => {
                                        const r = availableRoles.find(ar => ar.id === rid || ar._id === rid || ar.name === rid);
                                        return r ? r.name : rid;
                                    }).join(", ") || "No Role";
                                })()}
                            </span>
                        </div>
                        <span className={`${styles.statusBadge} ${formStatus ? styles.active : styles.inactive}`}>
                            {formStatus ? "Active" : "Inactive"}
                        </span>
                    </div>
                )}

                {!canEdit ? (
                    <>
                        {/* VIEW MODE */}
                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <SecurityIcon />
                                <span>Account & Access</span>
                            </div>
                            <div className={styles.grid}>
                                <ViewField label="Username" value={formUsername} />
                                <ViewField label="Role(s)" value={(() => {
                                    const roleIds = Array.isArray(formRole) ? formRole : (formRole ? [formRole] : []);
                                    return roleIds.map(rid => {
                                        const r = availableRoles.find(ar => ar.id === rid || ar._id === rid || ar.name === rid);
                                        return r ? r.name : rid;
                                    }).join(", ") || "-";
                                })()} />
                                <ViewField label="Status" value={formStatus ? "Active" : "Inactive"} />
                                <ViewField label="Pass Number" value={formPassNumber} />
                                {editingUser?.replacementFor && (
                                    <div className={`${styles.viewFieldCard} ${styles.fullWidthRow}`}>
                                        <span className={styles.label}>Replacement For (Relieved User)</span>
                                        <span
                                            className={styles.replacementLink}
                                            onClick={() => onViewReplacedUser && onViewReplacedUser(editingUser.replacementFor!)}
                                        >
                                            {editingUser.replacementForName || 'View Details'}
                                        </span>
                                    </div>
                                )}
                                {formIsMonitorUser && (
                                    <ViewField label="Monitor User" value="Yes — bypasses token expiry & session logout" />
                                )}
                            </div>
                        </div>

                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <PersonIcon />
                                <span>Personal Profile</span>
                            </div>
                            <div className={styles.grid}>
                                <ViewField label="First Name" value={formFirstName} />
                                <ViewField label="Last Name" value={formLastName} />

                                <ViewField label="Mobile Number" value={formMobile} />
                            </div>
                        </div>

                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <BadgeIcon />
                                <span>Employment Details</span>
                            </div>
                            <div className={styles.grid}>
                                <ViewField label="Department" value={(() => {
                                    const d = availableDepartments.find(ad => ad.id === formDepartment || ad._id === formDepartment || ad.name === formDepartment);
                                    return d ? d.name : formDepartment;
                                })()} />

                                <ViewField label="Date of Join" value={formDateOfJoin} />

                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* EDIT / CREATE MODE */}
                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <SecurityIcon />
                                <span>Account & Access</span>
                            </div>
                            <div className={styles.grid}>
                                <TextField
                                    fullWidth
                                    label="Username"
                                    value={formUsername}
                                    onChange={(e) => setFormUsername(e.target.value)}
                                    required
                                    disabled={!!editingUser && !hasUpdatePrivilege}
                                    error={!!usernameErr}
                                    helperText={usernameErr}
                                />
                                <TextField
                                    fullWidth
                                    label="Password"
                                    type="password"
                                    value={formPassword}
                                    onChange={(e) => setFormPassword(e.target.value)}
                                    required={!editingUser}
                                    error={!!passwordErr}
                                    helperText={passwordErr || (editingUser ? "Leave blank to keep existing password" : "")}
                                    sx={{
                                        '& .MuiFormHelperText-root': {
                                            color: passwordErr ? '#f44336' : '#637381'
                                        }
                                    }}
                                />
                                <Dropdown
                                    fullWidth
                                    multiple
                                    label="Role(s)"
                                    options={(availableRoles || []).map(r => ({ label: r.name, value: r.id || r._id }))}
                                    value={Array.isArray(formRole) ? formRole : (formRole ? [formRole] : [])}
                                    onChange={(val) => setFormRole(val)}
                                    clearable
                                />
                                <FormControl fullWidth>
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
                                <TextField
                                    fullWidth
                                    label="Pass Number"
                                    value={formPassNumber}
                                    onChange={(e) => setFormPassNumber(e.target.value)}
                                    error={!!passNumberErr}
                                    helperText={passNumberErr}
                                    inputProps={{ maxLength: 20 }}
                                />
                                <Dropdown
                                    fullWidth
                                    label="Replacement For (Relieved User)"
                                    options={(inactiveUsers || []).map(u => ({
                                        label: `${u.username} ${u.firstName || u.lastName ? `(${u.firstName || ''} ${u.lastName || ''})`.trim() : ''}`,
                                        value: u.id
                                    }))}
                                    value={formReplacementFor || ""}
                                    onChange={(val) => setFormReplacementFor(val)}
                                    clearable
                                />
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={formIsMonitorUser}
                                            onChange={(e) => setFormIsMonitorUser(e.target.checked)}
                                            size="small"
                                        />
                                    }
                                    label="Monitor User (bypass token expiry & session logout)"
                                    sx={{
                                        gridColumn: '1 / -1',
                                        '& .MuiFormControlLabel-label': { fontSize: '0.875rem', color: '#475569' }
                                    }}
                                />
                            </div>
                        </div>

                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <PersonIcon />
                                <span>Personal Profile</span>
                            </div>
                            <div className={styles.grid}>
                                <TextField
                                    fullWidth
                                    label="First Name"
                                    value={formFirstName}
                                    onChange={(e) => setFormFirstName(e.target.value)}
                                    error={!!firstNameErr}
                                    helperText={firstNameErr}
                                />
                                <TextField
                                    fullWidth
                                    label="Last Name"
                                    value={formLastName}
                                    onChange={(e) => setFormLastName(e.target.value)}
                                    error={!!lastNameErr}
                                    helperText={lastNameErr}
                                />

                                <TextField
                                    fullWidth
                                    label="Mobile Number"
                                    value={formMobile}
                                    onChange={(e) => setFormMobile(e.target.value)}
                                    error={!!mobileErr}
                                    helperText={mobileErr}
                                />
                            </div>
                        </div>

                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <BadgeIcon />
                                <span>Employment Details</span>
                            </div>
                            <div className={styles.grid}>
                                <Dropdown
                                    fullWidth
                                    label="Department"
                                    options={(availableDepartments || []).map(d => ({ label: d.name, value: d.id || d._id }))}
                                    value={formDepartment}
                                    onChange={(val) => {
                                        setFormDepartment(val);
                                    }}
                                    clearable
                                />
                                <DatePicker
                                    fullWidth
                                    label="Date of Join"
                                    value={formDateOfJoin}
                                    onChange={setFormDateOfJoin}
                                    error={!!dateOfJoinErr}
                                    helperText={dateOfJoinErr}
                                    maxDate={getLocalDateString()}
                                />

                            </div>
                        </div>
                    </>
                )}

                <div className={styles.actions}>
                    {canEdit ? (
                        <>
                            <Button variant="text" onClick={handleCloseModal}>Cancel</Button>
                            <Button type="submit" variant="contained" color="primary" disabled={hasFormErrors}>Save</Button>
                        </>
                    ) : (
                        <Button variant="text" onClick={handleCloseModal}>Close</Button>
                    )}
                </div>
            </form>
        </Modal>
    );
};

export default UserFormModal;