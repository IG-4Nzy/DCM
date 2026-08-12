import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Paper, TextField, Button, Typography, InputAdornment, IconButton } from '@mui/material';
import { MdVisibility, MdVisibilityOff, MdLockOutline } from 'react-icons/md';
import { motion } from 'framer-motion';
import { useToast } from '../contexts/ToastContext';
import { logoutUser, activateAccount } from '../store/authSlice';
import type { RootState } from '../store';
import request from '../services/request';

const PasswordResetModal: React.FC = () => {
  const dispatch = useDispatch<any>();
  const { username } = useSelector((state: RootState) => state.auth);
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('All fields are required', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters long', 'error');
      return;
    }
    if (currentPassword === newPassword) {
      showToast('New password cannot be the same as your current password', 'error');
      return;
    }

    try {
      setLoading(true);
      await request.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      showToast('Account activated successfully!', 'success');
      dispatch(activateAccount());
    } catch (err: any) {
      showToast(
        err.response?.data?.detail || 'Failed to change password and activate account',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Paper
          elevation={6}
          sx={{
            p: 4,
            width: '100%',
            maxWidth: 450,
            borderRadius: 4,
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.95)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              p: 2,
              borderRadius: '50%',
              bgcolor: 'rgba(25, 118, 210, 0.1)',
              color: 'primary.main',
              mb: 2,
            }}
          >
            <MdLockOutline size={32} />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#1e293b' }}>
            Activate Your Account
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
            Hi <strong>{username}</strong>, your account is not yet activated. Please change your temporary password to activate your account and gain access.
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Current Password"
              type={showCurrent ? 'text' : 'password'}
              variant="outlined"
              margin="normal"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle current password visibility"
                        onClick={() => setShowCurrent(!showCurrent)}
                        edge="end"
                        sx={{ color: '#64748b' }}
                      >
                        {showCurrent ? <MdVisibilityOff size={22} /> : <MdVisibility size={22} />}
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />

            <TextField
              fullWidth
              label="New Password"
              type={showNew ? 'text' : 'password'}
              variant="outlined"
              margin="normal"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle new password visibility"
                        onClick={() => setShowNew(!showNew)}
                        edge="end"
                        sx={{ color: '#64748b' }}
                      >
                        {showNew ? <MdVisibilityOff size={22} /> : <MdVisibility size={22} />}
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />

            <TextField
              fullWidth
              label="Confirm New Password"
              type={showConfirm ? 'text' : 'password'}
              variant="outlined"
              margin="normal"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle confirm password visibility"
                        onClick={() => setShowConfirm(!showConfirm)}
                        edge="end"
                        sx={{ color: '#64748b' }}
                      >
                        {showConfirm ? <MdVisibilityOff size={22} /> : <MdVisibility size={22} />}
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              disabled={loading}
              sx={{ mt: 3, mb: 2, borderRadius: 2, py: 1.5, fontWeight: 600, textTransform: 'none' }}
            >
              {loading ? 'Activating...' : 'Reset Password & Activate'}
            </Button>

            <Button
              fullWidth
              variant="text"
              color="inherit"
              onClick={handleLogout}
              disabled={loading}
              sx={{ color: '#64748b', fontWeight: 500, textTransform: 'none' }}
            >
              Log Out
            </Button>
          </form>
        </Paper>
      </motion.div>
    </Box>
  );
};

export default PasswordResetModal;
