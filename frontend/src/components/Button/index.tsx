import React from 'react';
import { Button as MuiButton, type ButtonProps as MuiButtonProps } from '@mui/material';

export interface CustomButtonProps extends MuiButtonProps {
  label?: string;
}

const Button: React.FC<CustomButtonProps> = ({ label, children, sx, ...props }) => {
  return (
    <MuiButton
      {...props}
      sx={{
        textTransform: 'none',
        borderRadius: '8px',
        fontWeight: 'bold',
        px: { xs: 2, md: 3 }, // Responsive padding
        boxShadow: props.variant === 'contained' ? '0 4px 14px 0 rgba(0,118,255,0.19)' : 'none',
        '&:hover': {
          boxShadow: props.variant === 'contained' ? '0 6px 20px rgba(0,118,255,0.23)' : 'none',
        },
        ...sx,
      }}
    >
      {label || children}
    </MuiButton>
  );
};

export default Button;
