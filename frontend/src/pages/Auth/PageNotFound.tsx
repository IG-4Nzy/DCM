import React from 'react';
import { Box, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const PageNotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          textAlign: 'center',
        }}
      >
      <label
        style={{
          fontSize: '10rem',
          fontWeight: 900,
          color: '#1976d2',
          textShadow: '2px 4px 10px rgba(0,0,0,0.1)',
          display: 'block'
        }}
      >
        404
      </label>
      <label style={{ fontSize: '2.125rem', display: 'block', marginBottom: '0.35em' }}>
        Page Not Found
      </label>
      <label
        style={{ display: 'block', marginBottom: '32px', color: 'rgba(0, 0, 0, 0.6)', maxWidth: '500px', margin: '0 auto 32px auto' }}
      >
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </label>
        <Button
          variant="contained"
          size="large"
          color="primary"
          onClick={() => navigate('/dashboard')}
        >
          Go to Dashboard
        </Button>
      </Box>
    </Container>
  );
};

export default PageNotFound;
