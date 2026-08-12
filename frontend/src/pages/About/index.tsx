// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Fade,
  Grow
} from '@mui/material';
import {
  MdCheckCircle,
  MdCloudUpload,
  MdBugReport,
  MdEdit,
  MdDelete,
  MdStars,
  MdClose,
  MdRefresh,
  MdSettings,
  MdDns,
  MdStorage,
  MdSpeed,
  MdVerifiedUser
} from 'react-icons/md';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import styles from './index.module.scss';
import {
  reportBug,
  fetchAboutDetails,
  updateAboutDetails,
  fetchBugReports,
  deleteBugReport
} from './action';

const About: React.FC = () => {
  const { privileges = [], isSuperuser } = useSelector((state: RootState) => state.auth);

  const canEdit = isSuperuser || privileges.includes("Edit About App");
  const canViewBugs = isSuperuser || privileges.includes("View Bug Reports");
  const canViewAbout = isSuperuser || privileges.includes("View About App");

  if (!canViewAbout) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
        <Typography variant="h6" color="error">You do not have permission to view this page.</Typography>
      </Box>
    );
  }

  const [loading, setLoading] = useState(true);
  const [appName, setAppName] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [newFeatures, setNewFeatures] = useState<string[]>([]);

  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [bugFile, setBugFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ appName: '', appVersion: '', newFeatures: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const [isBugsListModalOpen, setIsBugsListModalOpen] = useState(false);
  const [bugReports, setBugReports] = useState<any[]>([]);
  const [loadingBugs, setLoadingBugs] = useState(false);

  const loadAboutData = async () => {
    try {
      const res = await fetchAboutDetails();
      if (res.data) {
        setAppName(res.data.appName);
        setAppVersion(res.data.appVersion);
        setNewFeatures(res.data.newFeatures || []);
      }
    } catch (e) {
      console.error("Failed to load about details", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAboutData();
  }, []);

  const handleOpenBugModal = () => setIsBugModalOpen(true);
  const handleCloseBugModal = () => {
    setIsBugModalOpen(false);
    setBugDescription('');
    setBugFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setBugFile(e.target.files[0]);
    }
  };

  const handleSubmitBug = async () => {
    if (!bugDescription.trim()) {
      alert("Please enter a description for the bug.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("description", bugDescription);
      if (bugFile) {
        formData.append("image", bugFile);
      }

      await reportBug(formData);
      alert("Bug reported successfully! Thank you.");
      handleCloseBugModal();
    } catch (err) {
      alert("Failed to submit bug report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditModal = () => {
    setEditForm({
      appName,
      appVersion,
      newFeatures: newFeatures.join("\n")
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const payload = {
        appName: editForm.appName,
        appVersion: editForm.appVersion,
        newFeatures: editForm.newFeatures.split("\n").map(s => s.trim()).filter(s => s)
      };
      await updateAboutDetails(payload);
      await loadAboutData();
      setIsEditModalOpen(false);
    } catch (e) {
      alert("Failed to update about details");
    } finally {
      setSavingEdit(false);
    }
  };

  const loadBugReports = async () => {
    setLoadingBugs(true);
    try {
      const res = await fetchBugReports();
      setBugReports(res.data || []);
    } catch (e) {
      console.error("Failed to load bug reports", e);
    } finally {
      setLoadingBugs(false);
    }
  };

  const handleOpenBugsList = () => {
    setIsBugsListModalOpen(true);
    loadBugReports();
  };

  const handleDeleteBug = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this bug report?")) {
      try {
        await deleteBugReport(id);
        await loadBugReports();
      } catch (e) {
        alert("Failed to delete bug report");
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
        <CircularProgress size={60} thickness={4} sx={{ color: '#4f46e5' }} />
      </Box>
    );
  }

  return (
    <Box className={styles.aboutContainer}>

      <Box className={styles.contentWrapper}>

        {/* Header Hero Section */}
        <Box className={styles.heroSection}>
          <Box className={styles.heroLeft}>
            <Box className={styles.logoGlowWrapper}>
              D
            </Box>
            <Box className={styles.heroText}>
              <h1>{appName || "Datacentre Management System"}</h1>
              <Box className={styles.statusContainer}>
                <Box className={styles.statusPill}>
                  <div className={styles.pulseDot} />
                  Operational
                </Box>
                <Box className={styles.versionBadge}>
                  v{appVersion || "1.0.0"}
                </Box>
              </Box>
            </Box>
          </Box>

          <Box className={styles.actionButtons}>
            {canViewBugs && (
              <Button
                className={`${styles.btn} ${styles.btnSecondary}`}
                startIcon={<MdBugReport size={18} />}
                onClick={handleOpenBugsList}
              >
                Bug Inbox
              </Button>
            )}
            {canEdit && (
              <Button
                className={`${styles.btn} ${styles.btnPrimary}`}
                startIcon={<MdEdit size={18} />}
                onClick={handleOpenEditModal}
              >
                Modify Settings
              </Button>
            )}
          </Box>
        </Box>

        {/* Quick Stats Grid */}
        <Box className={styles.statsGrid}>
          <Box className={styles.statCard}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <MdVerifiedUser size={18} color="#475569" />
              <span className={styles.statLabel}>System License</span>
            </Box>
            <span className={styles.statValue}>Enterprise Edition</span>
          </Box>
          <Box className={styles.statCard}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <MdStorage size={18} color="#475569" />
              <span className={styles.statLabel}>Database Link</span>
            </Box>
            <span className={styles.statValue}>MongoDB Active</span>
          </Box>
          <Box className={styles.statCard}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <MdDns size={18} color="#475569" />
              <span className={styles.statLabel}>Server Platform</span>
            </Box>
            <span className={styles.statValue}>FastAPI Engine</span>
          </Box>
          <Box className={styles.statCard}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <MdSpeed size={18} color="#475569" />
              <span className={styles.statLabel}>Service Status</span>
            </Box>
            <span className={styles.statValue}>Live (Healthy)</span>
          </Box>
        </Box>

        {/* Changelog Timeline Section */}
        <Box className={styles.changelogSection}>
          <Typography className={styles.sectionHeader}>
            <MdStars size={24} /> What's New & System Updates
          </Typography>

          <Box className={styles.timeline}>
            {newFeatures.length > 0 ? (
              newFeatures.map((feature, idx) => (
                <Grow in={true} timeout={(idx + 1) * 150} key={idx}>
                  <Box className={styles.timelineItem}>
                    <Box className={styles.badge}>
                      <MdCheckCircle size={18} />
                    </Box>
                    <Box className={styles.text}>
                      {feature}
                    </Box>
                  </Box>
                </Grow>
              ))
            ) : (
              <Typography color="text.secondary" sx={{ py: 2 }}>No features listed for this build.</Typography>
            )}
          </Box>
        </Box>

        {/* Feedback Section */}
        <Box className={styles.feedbackSection}>
          <Box className={styles.feedbackContent}>
            <h2>Encountered an Issue?</h2>
            <p>
              Help us streamline operations. If you discover bugs, performance hiccups, or inconsistencies, report them to the development team directly.
            </p>
          </Box>
          <Button
            className={`${styles.btn} ${styles.btnDanger}`}
            startIcon={<MdBugReport size={18} />}
            onClick={handleOpenBugModal}
          >
            File Bug Report
          </Button>
        </Box>

      </Box>

      {/* Edit Modal */}
      <Dialog
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px', p: 1, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.25rem', color: '#0f172a' }}>
          Configure Portal Info
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 3 }}>
          <TextField
            label="Application Name"
            value={editForm.appName}
            onChange={(e) => setEditForm({ ...editForm, appName: e.target.value })}
            fullWidth
            variant="outlined"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Version Number"
            value={editForm.appVersion}
            onChange={(e) => setEditForm({ ...editForm, appVersion: e.target.value })}
            fullWidth
            variant="outlined"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Feature Log (One per line)"
            value={editForm.newFeatures}
            onChange={(e) => setEditForm({ ...editForm, newFeatures: e.target.value })}
            fullWidth
            multiline
            rows={6}
            variant="outlined"
            helperText="Enter each new feature or release note on a separate line."
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setIsEditModalOpen(false)} sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            disabled={savingEdit}
            sx={{
              bgcolor: '#0f172a',
              color: 'white',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              px: 3,
              '&:hover': {
                bgcolor: '#1e293b'
              }
            }}
          >
            {savingEdit ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bug Report Modal */}
      <Dialog
        open={isBugModalOpen}
        onClose={handleCloseBugModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px', p: 1, boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: 1, color: '#0f172a' }}>
          <MdBugReport color="#dc2626" size={24} /> File Bug Report
          <IconButton onClick={handleCloseBugModal} sx={{ ml: 'auto' }}>
            <MdClose />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Please outline the problem clearly. Attach a screenshot if applicable to help us troubleshoot faster.
          </Typography>

          <TextField
            label="Issue Description"
            multiline
            rows={4}
            value={bugDescription}
            onChange={(e) => setBugDescription(e.target.value)}
            fullWidth
            required
            variant="outlined"
            placeholder="Step-by-step description of what happened..."
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <Box sx={{ border: '2px dashed #cbd5e1', borderRadius: '8px', p: 4, textAlign: 'center', bgcolor: '#f8fafc', transition: 'all 0.2s', '&:hover': { borderColor: '#0f172a', bgcolor: '#f1f5f9' } }}>
            <input
              type="file"
              accept="image/*"
              id="bug-image-upload"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <label htmlFor="bug-image-upload">
              <Button
                component="span"
                variant="outlined"
                startIcon={<MdCloudUpload />}
                sx={{ textTransform: 'none', borderRadius: '6px', fontWeight: 600, color: '#0f172a', borderColor: '#d1d5db', '&:hover': { borderColor: '#9ca3af', bgcolor: '#f9fafb' } }}
              >
                Upload Attachment
              </Button>
            </label>
            {bugFile && (
              <Typography variant="body2" sx={{ mt: 2, color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <MdCheckCircle /> {bugFile.name}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, px: 3, gap: 1 }}>
          <Button onClick={handleCloseBugModal} sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitBug}
            variant="contained"
            disabled={submitting}
            sx={{
              bgcolor: '#dc2626',
              color: 'white',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              px: 3,
              '&:hover': {
                bgcolor: '#b91c1c'
              }
            }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Submit Report'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bugs List Modal */}
      <Dialog
        open={isBugsListModalOpen}
        onClose={() => setIsBugsListModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: "#333" }}>
            <MdBugReport color="#dc2626" size={24} /> Bug Submissions Inbox
          </Box>
          <IconButton onClick={loadBugReports} size="small" disabled={loadingBugs}>
            <MdRefresh size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#f8fafc' }}>
          {loadingBugs ? (
            <Box sx={{ p: 8, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, color: '#475569', borderBottom: '2px solid #e2e8f0', bgcolor: '#f1f5f9' } }}>
                    <TableCell>Date Reported</TableCell>
                    <TableCell>Reported By</TableCell>
                    <TableCell>Issue Details</TableCell>
                    <TableCell>Attachment</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bugReports.map((bug) => (
                    <TableRow key={bug._id} sx={{ '&:hover': { bgcolor: 'white' }, transition: 'background 0.2s' }}>
                      <TableCell sx={{ color: '#64748b', fontSize: '0.85rem' }}>{new Date(bug.reportedAt).toLocaleString()}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#0f172a' }}>{bug.reportedBy}</TableCell>
                      <TableCell sx={{ maxWidth: 300, whiteSpace: 'normal', wordBreak: 'break-word', color: '#334155' }}>
                        {bug.description}
                      </TableCell>
                      <TableCell>
                        {bug.imagePath ? (
                          <Button
                            href={`/${bug.imagePath}`}
                            target="_blank"
                            size="small"
                            variant="outlined"
                            sx={{ textTransform: 'none', borderRadius: '6px', fontSize: '0.8rem', borderColor: '#d1d5db', color: '#0f172a', '&:hover': { borderColor: '#9ca3af', bgcolor: '#f9fafb' } }}
                          >
                            View Screen
                          </Button>
                        ) : <Typography variant="caption" color="text.secondary">None</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="error" onClick={() => handleDeleteBug(bug._id)} sx={{ bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fecaca' } }}>
                          <MdDelete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {bugReports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 8, color: '#94a3b8' }}>
                        <MdBugReport size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} /><br />
                        <Typography sx={{ fontWeight: 600, color: '#64748b' }}>No bug reports found.</Typography>
                        <Typography variant="body2">System health is clear. Keep up the good work!</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc', gap: 1 }}>
          <Button onClick={() => setIsBugsListModalOpen(false)} sx={{ textTransform: 'none', fontWeight: 600, color: '#475569' }}>Close</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default About;
