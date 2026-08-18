// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginApi } from './action';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Typography, InputAdornment, IconButton } from '@mui/material';
import TextField from '../../components/TextField';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { motion } from 'framer-motion';
import { useToast } from '../../contexts/ToastContext';
import request from '../../services/request';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [birthdayWish, setBirthdayWish] = useState<{ open: boolean; name: string }>({ open: false, name: '' });
  const [restrictedLoginData, setRestrictedLoginData] = useState<any>(null);
  const dispatch = useDispatch<any>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [deployEnv, setDeployEnv] = useState<string>(() => {
    const raw = (import.meta.env.VITE_DEPLOY_ENV || '').toLowerCase().trim();
    return raw && !raw.includes('placeholder') ? raw : 'prod';
  });

  useEffect(() => {
    request.get('/api/config')
      .then(res => {
        if (res.data?.deploy) {
          setDeployEnv(res.data.deploy.toLowerCase().trim());
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'session_expired') {
      showToast('You have been logged out because you logged in from another device.', 'error');
      // Clean up the URL
      navigate('/login', { replace: true });
    }
  }, [navigate, showToast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(loginApi({
      credentials: { username, password },
      navigateToDashboard: () => { },
      showToast
    }));

    if (loginApi.fulfilled.match(result)) {
      const data = result.payload;
      if (data?.showBirthdayWish) {
        setBirthdayWish({ open: true, name: data.displayName || data.username || username });
      } else {
        navigateToDashboard();
      }
    } else if (loginApi.rejected.match(result)) {
      const data = result.payload as any;
      if (data && data.detail && typeof data.detail === 'object' && data.detail.restricted_token) {
        setRestrictedLoginData(data.detail);
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
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {deployEnv === 'test' && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 0,
            overflow: 'hidden',
            opacity: 0.05,
            userSelect: 'none',
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'space-around',
            justifyContent: 'space-around',
            transform: 'rotate(-25deg) scale(1.5)'
          }}
        >
          {Array.from({ length: 60 }).map((_, i) => (
            <Typography
              key={i}
              sx={{
                fontSize: '2.5rem',
                fontWeight: 900,
                letterSpacing: '6px',
                color: '#000000',
                m: 6,
                whiteSpace: 'nowrap'
              }}
            >
              DCM
            </Typography>
          ))}
        </Box>
      )}

      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ zIndex: 1 }}
      >
        <Paper
          elevation={4}
          sx={{
            padding: 5,
            width: 400,
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(10px)',
            position: 'relative'
          }}
        >
          {deployEnv === 'test' && (
            <Box
              sx={{
                textAlign: 'center',
                mb: 1.5
              }}
            >
              <Box
                sx={{
                  display: 'inline-block',
                  backgroundColor: '#ed6c02',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  px: 1.5,
                  py: 0.4,
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  boxShadow: '0 2px 6px rgba(237, 108, 2, 0.4)'
                }}
              >
                Test Environment
              </Box>
            </Box>
          )}

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
              type={showPassword ? 'text' : 'password'}
              variant="outlined"
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        sx={{ color: '#64748b' }}
                      >
                        {showPassword ? <MdVisibilityOff size={22} /> : <MdVisibility size={22} />}
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
              sx={{ mt: 3, borderRadius: 2, paddingY: 1.5 }}
            >
              Log In
            </Button>
          </form>
        </Paper>
      </motion.div>
      <Dialog open={birthdayWish.open} onClose={handleBirthdayClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#333' }}>
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
      <Dialog open={!!restrictedLoginData} onClose={() => setRestrictedLoginData(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#d32f2f' }}>
          Late Login Restricted
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569', mb: 2 }}>
            {restrictedLoginData?.message}
          </Typography>
          {restrictedLoginData?.privileges?.length > 0 ? (
            <Typography sx={{ color: '#475569' }}>
              However, you can still access checklists and work logs.
            </Typography>
          ) : (
            <Typography sx={{ color: '#9e9e9e', fontStyle: 'italic' }}>
              You do not have any checklist or work log privileges assigned to access.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestrictedLoginData(null)} sx={{ color: '#666', textTransform: 'none' }}>
            Cancel
          </Button>
          {restrictedLoginData?.privileges?.length > 0 && (
            <Button 
              onClick={() => {
                if (restrictedLoginData) {
                  dispatch({
                    type: 'auth/loginSuccess',
                    payload: {
                      token: restrictedLoginData.restricted_token,
                      role: 'Restricted',
                      username: restrictedLoginData.username,
                      privileges: restrictedLoginData.privileges,
                      isSuperuser: false,
                      displayName: restrictedLoginData.displayName
                    }
                  });
                  navigate('/daily-activities');
                }
              }}
              variant="contained" 
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Continue
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Login;
