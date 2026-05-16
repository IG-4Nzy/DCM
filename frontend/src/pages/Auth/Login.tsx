import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Box, Button, TextField, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import { loginSuccess } from '../../store/authSlice';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://127.0.0.1:8000/api/auth/login', {
        username,
        password
      });
      dispatch(loginSuccess(response.data));
      navigate('/dashboard');
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('An error occurred during login.');
      }
    }
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

            {error && (
              <label
                style={{
                  display: 'block',
                  color: 'red',
                  marginTop: '8px',
                  fontSize: '14px',
                }}
              >
                {error}
              </label>
            )}

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
    </Box>
  );
};

export default Login;
