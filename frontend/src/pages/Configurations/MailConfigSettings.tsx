// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, TextField, FormControlLabel, Checkbox, Divider, Grid } from '@mui/material';
import { useSelector } from 'react-redux';
import { type RootState } from '../../store';
import { hasPrivilege } from '../../helpers/authUtils';
import Button from '../../components/Button';
import { useToast } from '../../contexts/ToastContext';
import request from '../../services/request';

const MailConfigSettings: React.FC = () => {
    const { showToast } = useToast();
    const { isSuperuser } = useSelector((state: RootState) => state.auth);
    
    // User privileges check
    const canView = isSuperuser || hasPrivilege("Mail Config View") || hasPrivilege("Mail Config Update");
    const canUpdate = isSuperuser || hasPrivilege("Mail Config Update");

    // Edit toggles
    const [isEditing, setIsEditing] = useState(false);

    // Form states
    const [host, setHost] = useState('localhost');
    const [port, setPort] = useState(1025);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fromEmail, setFromEmail] = useState('noreply@dcm.local');
    const [useTls, setUseTls] = useState(false);
    const [useSsl, setUseSsl] = useState(false);
    const [savedEmailsText, setSavedEmailsText] = useState('');
    const [savedEmailsRosterText, setSavedEmailsRosterText] = useState('');
    const [savedEmailsDailyChecklistText, setSavedEmailsDailyChecklistText] = useState('');
    const [savedEmailsBmsChecklistText, setSavedEmailsBmsChecklistText] = useState('');
 
     // Test send email states
     const [testToEmail, setTestToEmail] = useState('');
     const [testLoading, setTestLoading] = useState(false);
     const [loading, setLoading] = useState(false);
 
     const loadData = async () => {
         if (!canView) return;
         try {
             setLoading(true);
             const res = await request.get('/api/mail-config/');
             if (res.data) {
                 setHost(res.data.host || 'localhost');
                 setPort(res.data.port || 1025);
                 setUsername(res.data.username || '');
                 setPassword(res.data.password || '');
                 setFromEmail(res.data.fromEmail || 'noreply@dcm.local');
                 setUseTls(res.data.useTls || false);
                 setUseSsl(res.data.useSsl || false);
                 const saved = res.data.savedEmails || [];
                 setSavedEmailsText(saved.join(', '));
                 const savedRoster = res.data.savedEmailsRoster || [];
                 setSavedEmailsRosterText(savedRoster.join(', '));
                 const savedDaily = res.data.savedEmailsDailyChecklist || [];
                 setSavedEmailsDailyChecklistText(savedDaily.join(', '));
                 const savedBms = res.data.savedEmailsBmsChecklist || [];
                 setSavedEmailsBmsChecklistText(savedBms.join(', '));
             }
         } catch (err: any) {
             showToast(err.response?.data?.detail || 'Failed to load mail configuration', 'error');
         } finally {
             setLoading(false);
         }
     };
 
     const handleSave = async () => {
         try {
             setLoading(true);
             const savedEmails = savedEmailsText
                 .split(',')
                 .map((e) => e.trim())
                 .filter((e) => e.length > 0);
             const savedEmailsRoster = savedEmailsRosterText
                 .split(',')
                 .map((e) => e.trim())
                 .filter((e) => e.length > 0);
             const savedEmailsDailyChecklist = savedEmailsDailyChecklistText
                 .split(',')
                 .map((e) => e.trim())
                 .filter((e) => e.length > 0);
             const savedEmailsBmsChecklist = savedEmailsBmsChecklistText
                 .split(',')
                 .map((e) => e.trim())
                 .filter((e) => e.length > 0);
 
             await request.put('/api/mail-config/', {
                 host,
                 port: Number(port),
                 username,
                 password,
                 fromEmail,
                 useTls,
                 useSsl,
                 savedEmails,
                 savedEmailsRoster,
                 savedEmailsDailyChecklist,
                 savedEmailsBmsChecklist
             });
             showToast('Mail configuration saved successfully!', 'success');
             setIsEditing(false);
         } catch (err: any) {
             showToast(err.response?.data?.detail || err.message || 'Failed to save configuration', 'error');
         } finally {
             setLoading(false);
         }
     };

    const handleCancel = () => {
        loadData();
        setIsEditing(false);
    };

    const handleSendTest = async () => {
        if (!testToEmail) {
            showToast('Please enter a recipient email address', 'warning');
            return;
        }
        try {
            setTestLoading(true);
            const res = await request.post('/api/mail-config/test', {
                toEmail: testToEmail,
                subject: "Test Connection Email",
                body: "This is a test email confirming that the Datacentre Management System (DCM) mail configuration is set up correctly!"
            });
            if (res.data?.success) {
                showToast(res.data.message || 'Test email sent successfully!', 'success');
            } else {
                showToast('Failed to send test email', 'error');
            }
        } catch (err: any) {
            showToast(err.response?.data?.detail || err.message || 'SMTP Connection Error', 'error');
        } finally {
            setTestLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    if (!canView) {
        return (
            <div style={{ padding: '24px', textAlign: 'center' }}>
                <Typography variant="h6" color="error" sx={{ fontWeight: 'bold' }}>
                    Access Denied
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                    You do not have privileges to view Mail Configuration.
                </Typography>
            </div>
        );
    }

    return (
        <Box sx={{ mt: 3 }}>
            <Paper sx={{ p: 4, maxWidth: 800, borderRadius: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, color: '#1e293b' }}>
                    SMTP Mail Server Configuration
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 4 }}>
                    Configure the outbound SMTP server settings to enable system-wide notifications and alerts.
                </Typography>

                {!canUpdate && (
                    <Box sx={{ mb: 4, p: 2, bgcolor: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 2, color: '#c53030' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Read-Only Access: You do not have permissions to update the mail configurations.
                        </Typography>
                    </Box>
                )}

                <Grid container spacing={3}>
                    <Grid item xs={12} sm={8}>
                        <TextField
                            label="SMTP Host"
                            fullWidth
                            size="small"
                            value={host}
                            onChange={(e) => setHost(e.target.value)}
                            disabled={!canUpdate || !isEditing}
                            placeholder="e.g. mail.domain.com or localhost"
                        />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField
                            label="SMTP Port"
                            type="number"
                            fullWidth
                            size="small"
                            value={port}
                            onChange={(e) => setPort(Number(e.target.value))}
                            disabled={!canUpdate || !isEditing}
                        />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Username"
                            fullWidth
                            size="small"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={!canUpdate || !isEditing}
                            placeholder="Username / Email"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Password"
                            type="password"
                            fullWidth
                            size="small"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={!canUpdate || !isEditing}
                            placeholder="••••••••"
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <TextField
                            label="From Email Address"
                            fullWidth
                            size="small"
                            value={fromEmail}
                            onChange={(e) => setFromEmail(e.target.value)}
                            disabled={!canUpdate || !isEditing}
                            placeholder="e.g. noreply@company.com"
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <TextField
                            label="Saved Default Emails - General (comma-separated)"
                            fullWidth
                            multiline
                            rows={2}
                            size="small"
                            value={savedEmailsText}
                            onChange={(e) => setSavedEmailsText(e.target.value)}
                            disabled={!canUpdate || !isEditing}
                            placeholder="e.g. user1@vssc.gov.in, user2@vssc.gov.in"
                            helperText="Fallback email addresses if module-specific lists are not configured."
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <TextField
                            label="Saved Default Emails - Duty Roster (comma-separated)"
                            fullWidth
                            multiline
                            rows={2}
                            size="small"
                            value={savedEmailsRosterText}
                            onChange={(e) => setSavedEmailsRosterText(e.target.value)}
                            disabled={!canUpdate || !isEditing}
                            placeholder="e.g. duty1@vssc.gov.in, duty2@vssc.gov.in"
                            helperText="Pre-configured recipients specifically for sending the Duty Roster."
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <TextField
                            label="Saved Default Emails - Cluster Checklist (comma-separated)"
                            fullWidth
                            multiline
                            rows={2}
                            size="small"
                            value={savedEmailsDailyChecklistText}
                            onChange={(e) => setSavedEmailsDailyChecklistText(e.target.value)}
                            disabled={!canUpdate || !isEditing}
                            placeholder="e.g. cluster1@vssc.gov.in, cluster2@vssc.gov.in"
                            helperText="Pre-configured recipients specifically for sending the Cluster Checklist."
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <TextField
                            label="Saved Default Emails - BMS Checklist (comma-separated)"
                            fullWidth
                            multiline
                            rows={2}
                            size="small"
                            value={savedEmailsBmsChecklistText}
                            onChange={(e) => setSavedEmailsBmsChecklistText(e.target.value)}
                            disabled={!canUpdate || !isEditing}
                            placeholder="e.g. bms1@vssc.gov.in, bms2@vssc.gov.in"
                            helperText="Pre-configured recipients specifically for sending the BMS Checklist."
                        />
                    </Grid>

                    <Grid item xs={12} sx={{ display: 'flex', gap: 4 }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={useTls}
                                    onChange={(e) => setUseTls(e.target.checked)}
                                    disabled={!canUpdate || !isEditing}
                                />
                            }
                            label="Use STARTTLS (TLS)"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={useSsl}
                                    onChange={(e) => setUseSsl(e.target.checked)}
                                    disabled={!canUpdate || !isEditing}
                                />
                            }
                            label="Use SSL/TLS"
                        />
                    </Grid>
                </Grid>

                {canUpdate && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
                        {!isEditing ? (
                            <Button 
                                variant="contained" 
                                color="secondary" 
                                onClick={() => setIsEditing(true)}
                                disabled={loading}
                            >
                                Edit Settings
                            </Button>
                        ) : (
                            <>
                                <Button 
                                    variant="outlined" 
                                    onClick={handleCancel}
                                    disabled={loading}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    variant="contained" 
                                    color="primary" 
                                    onClick={handleSave}
                                    disabled={loading}
                                >
                                    Save Settings
                                </Button>
                            </>
                        )}
                    </Box>
                )}

                <Divider sx={{ my: 4 }} />

                {/* Test Connection Section */}
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: '#1e293b' }}>
                    Verify Connection
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Send a test email to verify that your SMTP server connection and credentials are valid.
                </Typography>

                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={8}>
                        <TextField
                            label="Recipient Email Address"
                            fullWidth
                            size="small"
                            value={testToEmail}
                            onChange={(e) => setTestToEmail(e.target.value)}
                            placeholder="e.g. admin@company.com"
                        />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Button 
                            variant="contained" 
                            color="secondary"
                            fullWidth
                            onClick={handleSendTest}
                            disabled={testLoading || !testToEmail}
                            style={{ height: '40px' }}
                        >
                            {testLoading ? 'Sending...' : 'Send Test Email'}
                        </Button>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
};

export default MailConfigSettings;
