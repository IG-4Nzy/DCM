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
import { MdCheckCircle, MdCloudUpload, MdBugReport, MdEdit, MdDelete, MdStars, MdClose, MdRefresh } from 'react-icons/md';
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
        <CircularProgress size={60} thickness={4} sx={{ color: '#3b82f6' }} />
      </Box>
    );
  }

  return (
    <Box className={styles.aboutContainer}>
      <Box className={styles.contentWrapper}>
        
        {/* Header Hero Section */}
        <Box className={styles.headerCard}>
          <Box className={styles.versionBadge}>v{appVersion || "1.0.0"}</Box>
          <h1>{appName || "Datacentre Management"}</h1>
          <Box className={styles.actionButtons}>
            {canViewBugs && (
              <Button 
                className={`${styles.customButton} ${styles.outline}`}
                startIcon={<MdBugReport />}
                onClick={handleOpenBugsList}
              >
                View Bugs
              </Button>
            )}
            {canEdit && (
              <Button 
                className={`${styles.customButton} ${styles.primary}`}
                startIcon={<MdEdit />}
                onClick={handleOpenEditModal}
              >
                Edit App Info
              </Button>
            )}
          </Box>
        </Box>

        {/* Features Showcase */}
        <Box className={styles.featuresCard}>
          <Typography className={styles.featuresHeader}>
            <MdStars size={28} /> What's New
          </Typography>
          <Box className={styles.featuresList}>
            {newFeatures.length > 0 ? (
              newFeatures.map((feature, idx) => (
                <Grow in={true} timeout={(idx + 1) * 300} key={idx}>
                  <Box className={styles.featureItem}>
                    <Box className={styles.iconWrapper}>
                      <MdCheckCircle />
                    </Box>
                    <Box className={styles.featureText}>
                      {feature}
                    </Box>
                  </Box>
                </Grow>
              ))
            ) : (
              <Typography color="text.secondary">No features have been listed yet.</Typography>
            )}
          </Box>
        </Box>

        {/* Call to Action Footer */}
        <Box className={styles.footerCard}>
          <h2>Help Us Improve</h2>
          <p>
            Encountered an issue or have a suggestion? Let our team know by submitting a detailed bug report. We appreciate your help in making this system better!
          </p>
          <Button 
            className={`${styles.customButton} ${styles.error}`}
            startIcon={<MdBugReport size={20} />}
            onClick={handleOpenBugModal}
            sx={{ px: 4, py: 1.5, fontSize: '1.05rem', mt: 2 }}
          >
            Report an Issue
          </Button>
        </Box>

      </Box>

      {/* Edit Modal (MUI Default styled) */}
      <Dialog 
        open={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.5rem', color: '#0f172a' }}>
          Configure App Details
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 3 }}>
          <TextField 
            label="Application Name" 
            value={editForm.appName} 
            onChange={(e) => setEditForm({ ...editForm, appName: e.target.value })}
            fullWidth 
            variant="outlined"
          />
          <TextField 
            label="Version Number" 
            value={editForm.appVersion} 
            onChange={(e) => setEditForm({ ...editForm, appVersion: e.target.value })}
            fullWidth 
            variant="outlined"
          />
          <TextField 
            label="Feature Log (One per line)" 
            value={editForm.newFeatures} 
            onChange={(e) => setEditForm({ ...editForm, newFeatures: e.target.value })}
            fullWidth 
            multiline
            rows={8}
            variant="outlined"
            helperText="Enter each new feature on a new line."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setIsEditModalOpen(false)} sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained" disabled={savingEdit} sx={{ bgcolor: '#3b82f6', textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}>
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
        PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 1, color: '#0f172a' }}>
          <MdBugReport color="#ef4444" size={32} /> Report Issue
          <IconButton onClick={handleCloseBugModal} sx={{ ml: 'auto' }}>
            <MdClose />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          <Typography variant="body1" sx={{ color: '#475569' }}>
            Describe what happened. The more details you provide, the easier it is for us to fix it.
          </Typography>
          
          <TextField
            label="Issue Description"
            multiline
            rows={5}
            value={bugDescription}
            onChange={(e) => setBugDescription(e.target.value)}
            fullWidth
            required
            variant="outlined"
            placeholder="I clicked on..."
          />

          <Box sx={{ border: '2px dashed #cbd5e1', borderRadius: '12px', p: 4, textAlign: 'center', bgcolor: '#f8fafc', transition: 'all 0.2s', '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' } }}>
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
                sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600, color: '#3b82f6', borderColor: '#3b82f6' }}
              >
                Upload Screenshot
              </Button>
            </label>
            {bugFile && (
              <Typography variant="body2" sx={{ mt: 2, color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <MdCheckCircle /> {bugFile.name}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, px: 3 }}>
          <Button onClick={handleCloseBugModal} sx={{ color: '#64748b', textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmitBug} 
            variant="contained" 
            color="error"
            disabled={submitting}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px', minWidth: 120 }}
          >
            {submitting ? <CircularProgress size={24} color="inherit" /> : 'Submit Report'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bugs List Modal */}
      <Dialog 
        open={isBugsListModalOpen} 
        onClose={() => setIsBugsListModalOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MdBugReport color="#ef4444" /> Bug Reports Inbox
          </Box>
          <IconButton onClick={loadBugReports} size="small" disabled={loadingBugs}>
            <MdRefresh />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#f8fafc' }}>
          {loadingBugs ? (
            <Box sx={{ p: 8, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, color: '#475569', borderBottom: '2px solid #e2e8f0' } }}>
                    <TableCell>Date reported</TableCell>
                    <TableCell>Reported By</TableCell>
                    <TableCell>Issue Details</TableCell>
                    <TableCell>Attachment</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bugReports.map((bug) => (
                    <TableRow key={bug._id} sx={{ '&:hover': { bgcolor: 'white' }, transition: 'background 0.2s' }}>
                      <TableCell sx={{ color: '#64748b', fontSize: '0.9rem' }}>{new Date(bug.reportedAt).toLocaleString()}</TableCell>
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
                            sx={{ textTransform: 'none', borderRadius: '6px', fontSize: '0.8rem' }}
                          >
                            View Image
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
                      <TableCell colSpan={5} align="center" sx={{ py: 6, color: '#94a3b8' }}>
                        <MdBugReport size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} /><br />
                        No bug reports currently in the system. Great job!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setIsBugsListModalOpen(false)} sx={{ textTransform: 'none', fontWeight: 600, color: '#475569' }}>Close</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default About;
