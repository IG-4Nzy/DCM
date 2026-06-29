// @ts-nocheck
import React, { createContext, useContext, useState, type ReactNode, useCallback } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

interface ConfirmContextType {
  confirm: (message: string, title?: string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

interface ConfirmProviderProps {
  children: ReactNode;
}

export const ConfirmProvider: React.FC<ConfirmProviderProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [resolve, setResolve] = useState<(value: boolean) => void>();

  const confirm = useCallback((message: string, title = 'Confirm') => {
    setMessage(message);
    setTitle(title);
    setOpen(true);
    return new Promise<boolean>((res) => {
      setResolve(() => res);
    });
  }, []);

  const handleClose = (value: boolean) => {
    setOpen(false);
    if (resolve) {
      resolve(value);
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Dialog
        open={open}
        onClose={() => handleClose(false)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              p: 1,
              minWidth: 350,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', color: "#333" }}>{title}</DialogTitle>
        <DialogContent>
          <Typography>{message}</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={() => handleClose(false)} color="inherit" sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button onClick={() => handleClose(true)} color="primary" variant="contained" sx={{ borderRadius: 2 }}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
};
