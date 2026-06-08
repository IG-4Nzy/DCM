import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginApi } from './action';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useToast } from '../../contexts/ToastContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [birthdayWish, setBirthdayWish] = useState<{ open: boolean; name: string }>({ open: false, name: '' });
  const dispatch = useDispatch<any>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(loginApi({
      credentials: { username, password },
      navigateToDashboard: () => {},
      showToast
    }));

    if (loginApi.fulfilled.match(result)) {
      const data = result.payload;
      if (data?.showBirthdayWish) {
        setBirthdayWish({ open: true, name: data.displayName || data.username || username });
      } else {
        navigateToDashboard();
      }
    }
  };

  const navigateToDashboard = () => {
    navigate('/dashboard');
  };

  const handleBirthdayClose = () => {
    setBirthdayWish({ open: false, name: '' });
    navigateToDashboard();
  };

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Paper
          elevation={4}
          sx={{
            padding: 5,
            width: 400,
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <label
            style={{
              display: 'block',
              textAlign: 'center',
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#1976d2',
              marginBottom: '8px',
            }}
          >
            DCM
          </label>

          <label
            style={{
              display: 'block',
              textAlign: 'center',
              fontSize: '14px',
              color: '#666',
              marginBottom: '32px',
            }}
          >
            Data Centre Staff Management
          </label>

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Username"
              variant="outlined"
              margin="normal"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <TextField
              fullWidth
              label="Password"
              type="password"
              variant="outlined"
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              sx={{ mt: 3, borderRadius: 2, paddingY: 1.5 }}
            >
              Log In
            </Button>
          </form>
        </Paper>
      </motion.div>
      <Dialog open={birthdayWish.open} onClose={handleBirthdayClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1976d2' }}>
          Happy Birthday, {birthdayWish.name}!
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569' }}>
            Wishing you a wonderful day and a great year ahead.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBirthdayClose} variant="contained" sx={{ textTransform: 'none', fontWeight: 600 }}>
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Login;
