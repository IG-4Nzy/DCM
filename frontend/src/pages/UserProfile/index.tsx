// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
    Box,
    Paper,
    Avatar,
    Button,
} from "@mui/material";
import {
    MdEdit as EditIcon,
    MdSave as SaveIcon,
    MdClose as CancelIcon,
} from "react-icons/md";
import TextField from "../../components/TextField";
import Dropdown from "../../components/Dropdown";
import { useToast } from "../../contexts/ToastContext";
import request from "../../services/request";
import type { RootState } from "../../store";
import styles from "./index.module.scss";

interface UserProfileData {
    id: string;
    username: string;
    role: string;
    status: boolean;
    firstName: string;
    lastName: string;
    dob: string;
    mobile: string;
    bloodGroup: string;
    address: string;
    dateOfJoin: string;
    department: string;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const UserProfile: React.FC = () => {
    const { username } = useSelector((state: RootState) => state.auth);
    const { showToast } = useToast();

    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [changingPassword, setChangingPassword] = useState(false);
    const [updatingPassword, setUpdatingPassword] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        dob: "",
        mobile: "",
        bloodGroup: "",
        address: "",
    });

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const res = await request.get("/api/auth/me");
            setProfile(res.data);
            setForm({
                firstName: res.data.firstName || "",
                lastName: res.data.lastName || "",
                dob: res.data.dob || "",
                mobile: res.data.mobile || "",
                bloodGroup: res.data.bloodGroup || "",
                address: res.data.address || "",
            });
        } catch (err: any) {
            showToast(
                err.response?.data?.detail || "Failed to load profile",
                "error",
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const handleCancel = () => {
        if (profile) {
            setForm({
                firstName: profile.firstName || "",
                lastName: profile.lastName || "",
                dob: profile.dob || "",
                mobile: profile.mobile || "",
                bloodGroup: profile.bloodGroup || "",
                address: profile.address || "",
            });
        }
        setEditing(false);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const payload: any = {};
            Object.entries(form).forEach(([k, v]) => {
                if (v) payload[k] = v;
            });
            const res = await request.put("/api/auth/me", payload);
            setProfile(res.data);
            setEditing(false);
            showToast("Profile updated successfully", "success");
        } catch (err: any) {
            showToast(
                err.response?.data?.detail || "Failed to update profile",
                "error",
            );
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
            showToast("All password fields are required", "error");
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            showToast("New passwords do not match", "error");
            return;
        }
        if (passwordForm.newPassword.length < 6) {
            showToast("Password must be at least 6 characters long", "error");
            return;
        }
        try {
            setUpdatingPassword(true);
            await request.post("/api/auth/change-password", {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            showToast("Password changed successfully", "success");
            setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
            setChangingPassword(false);
        } catch (err: any) {
            showToast(
                err.response?.data?.detail || "Failed to change password",
                "error"
            );
        } finally {
            setUpdatingPassword(false);
        }
    };

    const getInitials = () => {
        const f = (profile?.firstName || username || "").charAt(0).toUpperCase();
        const l = (profile?.lastName || "").charAt(0).toUpperCase();
        return l ? `${f}${l}` : f || "?";
    };

    const getDisplayName = () => {
        if (profile?.firstName && profile?.lastName)
            return `${profile.firstName} ${profile.lastName}`;
        if (profile?.firstName) return profile.firstName;
        return profile?.username || "";
    };

    if (loading) {
        return (
            <Box className={styles.page}>
                <Box className={styles.center}>
                    <label className={styles.muted}>Loading profile...</label>
                </Box>
            </Box>
        );
    }
    if (!profile) {
        return (
            <Box className={styles.page}>
                <Box className={styles.center}>
                    <label className={styles.muted}>Could not load profile.</label>
                </Box>
            </Box>
        );
    }

    const InfoRow = ({ label, value }: { label: string; value: string }) => (
        <Box className={styles.infoRow}>
            <label className={styles.infoLabel}>{label}</label>
            <label className={styles.infoValue}>{value || "—"}</label>
        </Box>
    );

    return (
        <Box className={styles.page}>
            <Box className={styles.container}>
                {/* Profile Header */}
                <Paper className={styles.card} elevation={0}>
                    <Box className={styles.profileHeader}>
                        <Avatar className={styles.avatar}>{getInitials()}</Avatar>
                        <Box className={styles.profileMeta}>
                            <label className={styles.name}>{getDisplayName()}</label>
                            <label className={styles.username}>@{profile.username}</label>
                            <Box className={styles.badges}>
                                <span className={styles.roleBadge}>{profile.role}</span>
                                <span
                                    className={`${styles.statusDot} ${profile.status ? styles.active : styles.inactive}`}
                                />
                                <span className={styles.statusText}>
                                    {profile.status ? "Active" : "Inactive"}
                                </span>
                            </Box>
                        </Box>
                        <Box className={styles.headerAction}>
                            {!editing ? (
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<EditIcon />}
                                    onClick={() => setEditing(true)}
                                    sx={{
                                        borderRadius: "8px",
                                        textTransform: "none",
                                        fontWeight: 600,
                                    }}
                                >
                                    Edit
                                </Button>
                            ) : (
                                <Box sx={{ display: "flex", gap: 1 }}>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        startIcon={<SaveIcon />}
                                        onClick={handleSave}
                                        disabled={saving}
                                        sx={{
                                            borderRadius: "8px",
                                            textTransform: "none",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {saving ? "Saving..." : "Save"}
                                    </Button>
                                    <Button
                                        variant="text"
                                        size="small"
                                        startIcon={<CancelIcon />}
                                        onClick={handleCancel}
                                        sx={{ borderRadius: "8px", textTransform: "none" }}
                                    >
                                        Cancel
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Paper>

                {/* Personal Info */}
                <Paper className={styles.card} elevation={0}>
                    <label className={styles.sectionTitle}>Personal Information</label>
                    {editing ? (
                        <Box className={styles.formGrid}>
                            <TextField
                                label="First Name"
                                value={form.firstName}
                                onChange={(e) =>
                                    setForm({ ...form, firstName: e.target.value })
                                }
                                className={styles.field}
                            />
                            <TextField

                                label="Last Name"
                                value={form.lastName}
                                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                                className={styles.field}
                            />
                            <TextField

                                label="Date of Birth"
                                type="date"
                                value={form.dob}
                                onChange={(e) => setForm({ ...form, dob: e.target.value })}
                                className={styles.field}
                                slotProps={{
                                    inputLabel: {
                                        shrink: true,
                                    },
                                }}
                            />
                            <Dropdown
                                label="Blood Group"
                                value={form.bloodGroup}
                                onChange={(val) => setForm({ ...form, bloodGroup: val })}
                                options={BLOOD_GROUPS.map(bg => ({ label: bg, value: bg }))}
                                className={styles.field}
                                clearable
                            />
                        </Box>
                    ) : (
                        <Box className={styles.infoGrid}>
                            <InfoRow label="First Name" value={profile.firstName} />
                            <InfoRow label="Last Name" value={profile.lastName} />
                            <InfoRow label="Date of Birth" value={profile.dob} />
                            <InfoRow label="Blood Group" value={profile.bloodGroup} />
                        </Box>
                    )}
                </Paper>

                {/* Contact Info */}
                <Paper className={styles.card} elevation={0}>
                    <label className={styles.sectionTitle}>Contact</label>
                    {editing ? (
                        <Box className={styles.formGrid}>
                            <TextField

                                label="Mobile"
                                value={form.mobile}
                                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                                className={styles.field}
                            />
                            <TextField

                                label="Address"
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                className={styles.field}
                            />
                        </Box>
                    ) : (
                        <Box className={styles.infoGrid}>
                            <InfoRow label="Mobile" value={profile.mobile} />
                            <InfoRow label="Address" value={profile.address} />
                        </Box>
                    )}
                </Paper>

                {/* Organization Info (read-only always) */}
                <Paper className={styles.card} elevation={0}>
                    <label className={styles.sectionTitle}>Organization</label>
                    <Box className={styles.infoGrid}>
                        <InfoRow label="Department" value={profile.department} />
                        <InfoRow label="Date of Joining" value={profile.dateOfJoin} />
                        <InfoRow label="Role" value={profile.role} />
                        <InfoRow
                            label="Status"
                            value={profile.status ? "Active" : "Inactive"}
                        />
                    </Box>
                </Paper>

                {/* Security - Change Password */}
                <Paper className={styles.card} elevation={0}>
                    <label className={styles.sectionTitle}>Security & Credentials</label>
                    {!changingPassword ? (
                        <Box sx={{ display: "flex", justifyContent: "flex-start", mt: 1 }}>
                            <Button
                                variant="outlined"
                                color="primary"
                                onClick={() => setChangingPassword(true)}
                                sx={{
                                    borderRadius: "8px",
                                    textTransform: "none",
                                    fontWeight: 600,
                                }}
                            >
                                Change Password
                            </Button>
                        </Box>
                    ) : (
                        <form onSubmit={handlePasswordChange}>
                            <Box className={styles.formGrid} sx={{ mb: 3 }}>
                                <TextField
                                    label="Current Password"
                                    type="password"
                                    required
                                    value={passwordForm.currentPassword}
                                    onChange={(e) =>
                                        setPasswordForm({
                                            ...passwordForm,
                                            currentPassword: e.target.value,
                                        })
                                    }
                                    className={styles.field}
                                />
                                <TextField
                                    label="New Password"
                                    type="password"
                                    required
                                    value={passwordForm.newPassword}
                                    onChange={(e) =>
                                        setPasswordForm({
                                            ...passwordForm,
                                            newPassword: e.target.value,
                                        })
                                    }
                                    className={styles.field}
                                />
                                <TextField
                                    label="Confirm New Password"
                                    type="password"
                                    required
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) =>
                                        setPasswordForm({
                                            ...passwordForm,
                                            confirmPassword: e.target.value,
                                        })
                                    }
                                    className={styles.field}
                                />
                            </Box>
                            <Box sx={{ display: "flex", gap: 1.5 }}>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    color="primary"
                                    disabled={updatingPassword}
                                    sx={{
                                        borderRadius: "8px",
                                        textTransform: "none",
                                        fontWeight: 600,
                                    }}
                                >
                                    {updatingPassword ? "Updating..." : "Update Password"}
                                </Button>
                                <Button
                                    variant="text"
                                    color="inherit"
                                    onClick={() => {
                                        setChangingPassword(false);
                                        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                                    }}
                                    sx={{
                                        borderRadius: "8px",
                                        textTransform: "none",
                                    }}
                                >
                                    Cancel
                                </Button>
                            </Box>
                        </form>
                    )}
                </Paper>
            </Box>
        </Box>
    );
};

export default UserProfile;
