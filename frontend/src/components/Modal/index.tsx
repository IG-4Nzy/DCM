// @ts-nocheck
import React from 'react';
import { Dialog, IconButton, Box } from '@mui/material';
import { MdClose as CloseIcon } from 'react-icons/md';

interface ModalProps {
  open: boolean;
  handleClose: () => void;
  children: React.ReactNode;
  title?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
}

const Modal: React.FC<ModalProps> = ({ open, handleClose, children, title, maxWidth = 'sm' }) => {
  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth={maxWidth} 
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
        }
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: title ? 2 : 0 }}>
        {title && (
          <label style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#212b36' }}>
            {title}
          </label>
        )}
        <IconButton onClick={handleClose} size="small" sx={{ ml: 'auto', color: '#637381' }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Box>
        {children}
      </Box>
    </Dialog>
  );
};

export default Modal;
