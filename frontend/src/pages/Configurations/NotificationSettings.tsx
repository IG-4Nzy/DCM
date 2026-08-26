// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, Divider, Autocomplete } from '@mui/material';
import TextField from '../../components/TextField';
import { useSelector } from 'react-redux';
import { type RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import { PRIVILEGES } from '../../helpers/privileges';
import Button from '../../components/Button';
import { useToast } from '../../contexts/ToastContext';
import request from '../../services/request';

interface RoleOption {
    id?: string;
    _id?: string;
    name: string;
}

const NotificationSettings: React.FC = () => {
    const { showToast } = useToast();
    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    const canUpdate = isSuperuser || hasPrivilege(PRIVILEGES.CONFIGURATION_UPDATE);
    
    const [rolesList, setRolesList] = useState<RoleOption[]>([]);

    // States for all categories
    const [announcementText, setAnnouncementText] = useState('new announcement published');
    const [announcementSoundType, setAnnouncementSoundType] = useState('tts');
    const [announcementRoles, setAnnouncementRoles] = useState<string[]>([]);
    
    const [workText, setWorkText] = useState('new work has been assigned');
    const [workSoundType, setWorkSoundType] = useState('tts');
    const [workRoles, setWorkRoles] = useState<string[]>([]);

    const [requestText, setRequestText] = useState('New request has been assigned.');
    const [requestSoundType, setRequestSoundType] = useState('tts');
    const [requestRoles, setRequestRoles] = useState<string[]>([]);

    const [periodicText, setPeriodicText] = useState('periodic activity alert');
    const [periodicSoundType, setPeriodicSoundType] = useState('tts');
    const [periodicRoles, setPeriodicRoles] = useState<string[]>([]);

    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            
            // 1. Fetch available roles
            const rolesRes = await request.get('/api/roles/', {
                params: { pagination: false }
            });
            if (rolesRes.data && rolesRes.data.data) {
                setRolesList(rolesRes.data.data);
            }

            // 2. Fetch current settings
            const settingsRes = await request.get('/api/notifications/settings');
            if (settingsRes.data) {
                setAnnouncementText(settingsRes.data.announcement_text || 'new announcement published');
                setAnnouncementSoundType(settingsRes.data.announcement_sound_type || 'tts');
                setAnnouncementRoles(settingsRes.data.announcement_roles || []);
                
                setWorkText(settingsRes.data.work_text || 'new work has been assigned');
                setWorkSoundType(settingsRes.data.work_sound_type || 'tts');
                setWorkRoles(settingsRes.data.work_roles || []);

                setRequestText(settingsRes.data.request_text || 'New request has been assigned.');
                setRequestSoundType(settingsRes.data.request_sound_type || 'tts');
                setRequestRoles(settingsRes.data.request_roles || []);

                setPeriodicText(settingsRes.data.periodic_text || 'periodic activity alert');
                setPeriodicSoundType(settingsRes.data.periodic_sound_type || 'tts');
                setPeriodicRoles(settingsRes.data.periodic_roles || []);
            }
        } catch (err: any) {
            showToast('Failed to load settings data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            await request.post('/api/notifications/settings', {
                announcement_text: announcementText,
                announcement_sound_type: announcementSoundType,
                announcement_roles: announcementRoles,
                work_text: workText,
                work_sound_type: workSoundType,
                work_roles: workRoles,
                request_text: requestText,
                request_sound_type: requestSoundType,
                request_roles: requestRoles,
                periodic_text: periodicText,
                periodic_sound_type: periodicSoundType,
                periodic_roles: periodicRoles
            });
            showToast('Notification settings saved successfully!', 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to save notification settings', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const roleNames = rolesList.map(r => r.name);

    return (
        <Box sx={{ mt: 3 }}>
            <Paper sx={{ p: 4, maxWidth: 800, borderRadius: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#1e293b' }}>
                    Notification Audio & Filter Configuration
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 4 }}>
                    Configure the text-to-speech (TTS) readouts, sound alerts, and assignee role filters for each system module.
                </Typography>

                {!canUpdate && (
                    <Box sx={{ mb: 4, p: 2, bgcolor: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 2, color: '#c53030' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Read-Only Access: You do not have permissions to modify notification configurations.
                        </Typography>
                    </Box>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    
                    {/* Announcement Section */}
                    <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 2 }}>
                            📢 Announcements
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pl: 2, borderLeft: '3px solid #3b82f6' }}>
                            <TextField
                                label="Announcement Text"
                                fullWidth
                                size="small"
                                value={announcementText}
                                onChange={(e) => setAnnouncementText(e.target.value)}
                                placeholder="e.g. new announcement published"
                                helperText="Text to speak when a new announcement is posted"
                                disabled={!canUpdate}
                            />
                            <FormControl disabled={!canUpdate}>
                                <FormLabel sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569', mb: 0.5 }}>
                                    Sound Option
                                </FormLabel>
                                <RadioGroup
                                    row
                                    value={announcementSoundType}
                                    onChange={(e) => setAnnouncementSoundType(e.target.value)}
                                >
                                    <FormControlLabel value="tts" control={<Radio size="small" />} label="Text-to-Speech" />
                                    <FormControlLabel value="beep" control={<Radio size="small" />} label="Beep Sound" />
                                </RadioGroup>
                            </FormControl>
                            <Autocomplete
                                multiple
                                size="small"
                                options={roleNames}
                                value={announcementRoles}
                                onChange={(_, newValue) => setAnnouncementRoles(newValue)}
                                disabled={!canUpdate}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Announcement Creator Roles Filter"
                                        placeholder="Select roles"
                                        helperText="Only alert/display announcements if the creator belongs to any of these roles (leave empty for all)"
                                    />
                                )}
                            />
                        </Box>
                    </Box>

                    <Divider />

                    {/* Works Section */}
                    <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 2 }}>
                            🛠️ Works
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pl: 2, borderLeft: '3px solid #10b981' }}>
                            <TextField
                                label="Work Assigned Text"
                                fullWidth
                                size="small"
                                value={workText}
                                onChange={(e) => setWorkText(e.target.value)}
                                placeholder="e.g. new work has been assigned"
                                helperText="Text to speak when a new work is assigned"
                                disabled={!canUpdate}
                            />
                            <FormControl disabled={!canUpdate}>
                                <FormLabel sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569', mb: 0.5 }}>
                                    Sound Option
                                </FormLabel>
                                <RadioGroup
                                    row
                                    value={workSoundType}
                                    onChange={(e) => setWorkSoundType(e.target.value)}
                                >
                                    <FormControlLabel value="tts" control={<Radio size="small" />} label="Text-to-Speech" />
                                    <FormControlLabel value="beep" control={<Radio size="small" />} label="Beep Sound" />
                                </RadioGroup>
                            </FormControl>
                            <Autocomplete
                                multiple
                                size="small"
                                options={roleNames}
                                value={workRoles}
                                onChange={(_, newValue) => setWorkRoles(newValue)}
                                disabled={!canUpdate}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Work Assignee Roles Filter"
                                        placeholder="Select roles"
                                        helperText="Only alert/display works if the assignee belongs to any of these roles (leave empty for all)"
                                    />
                                )}
                            />
                        </Box>
                    </Box>

                    <Divider />

                    {/* Requests Section */}
                    <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 2 }}>
                            📥 Requests
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pl: 2, borderLeft: '3px solid #8b5cf6' }}>
                            <TextField
                                label="Request Assigned Text"
                                fullWidth
                                size="small"
                                value={requestText}
                                onChange={(e) => setRequestText(e.target.value)}
                                placeholder="e.g. New request has been assigned."
                                helperText="Text to speak when a new request is assigned"
                                disabled={!canUpdate}
                            />
                            <FormControl disabled={!canUpdate}>
                                <FormLabel sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569', mb: 0.5 }}>
                                    Sound Option
                                </FormLabel>
                                <RadioGroup
                                    row
                                    value={requestSoundType}
                                    onChange={(e) => setRequestSoundType(e.target.value)}
                                >
                                    <FormControlLabel value="tts" control={<Radio size="small" />} label="Text-to-Speech" />
                                    <FormControlLabel value="beep" control={<Radio size="small" />} label="Beep Sound" />
                                </RadioGroup>
                            </FormControl>
                            <Autocomplete
                                multiple
                                size="small"
                                options={roleNames}
                                value={requestRoles}
                                onChange={(_, newValue) => setRequestRoles(newValue)}
                                disabled={!canUpdate}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Request Creator Roles Filter"
                                        placeholder="Select roles"
                                        helperText="Only alert/display requests if the creator belongs to any of these roles (leave empty for all)"
                                    />
                                )}
                            />
                        </Box>
                    </Box>

                    <Divider />

                    {/* Periodic Activities Section */}
                    <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 2 }}>
                            📅 Periodic Activities
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pl: 2, borderLeft: '3px solid #f59e0b' }}>
                            <TextField
                                label="Periodic Activity Text"
                                fullWidth
                                size="small"
                                value={periodicText}
                                onChange={(e) => setPeriodicText(e.target.value)}
                                placeholder="e.g. periodic activity alert"
                                helperText="Text to speak when a periodic activity alert triggers"
                                disabled={!canUpdate}
                            />
                            <FormControl disabled={!canUpdate}>
                                <FormLabel sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569', mb: 0.5 }}>
                                    Sound Option
                                </FormLabel>
                                <RadioGroup
                                    row
                                    value={periodicSoundType}
                                    onChange={(e) => setPeriodicSoundType(e.target.value)}
                                >
                                    <FormControlLabel value="tts" control={<Radio size="small" />} label="Text-to-Speech" />
                                    <FormControlLabel value="beep" control={<Radio size="small" />} label="Beep Sound" />
                                </RadioGroup>
                            </FormControl>
                            <Autocomplete
                                multiple
                                size="small"
                                options={roleNames}
                                value={periodicRoles}
                                onChange={(_, newValue) => setPeriodicRoles(newValue)}
                                disabled={!canUpdate}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Periodic Activity Creator Roles Filter"
                                        placeholder="Select roles"
                                        helperText="Only alert/display periodic activities if the creator belongs to any of these roles (leave empty for all)"
                                    />
                                )}
                            />
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                        <Button 
                            variant="contained" 
                            color="primary" 
                            onClick={handleSave}
                            disabled={loading || !canUpdate}
                        >
                            Save Configuration
                        </Button>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default NotificationSettings;
