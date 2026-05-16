import React from 'react';
import { TextField as MuiTextField, type TextFieldProps as MuiTextFieldProps } from '@mui/material';

const TextField: React.FC<MuiTextFieldProps> = (props) => {
  return (
    <MuiTextField
      {...props}
      sx={{
        width: { xs: '100%', sm: 300, md: 400 }, // Responsive width
        '& .MuiOutlinedInput-root': {
          borderRadius: '8px',
          backgroundColor: '#fff',
        },
        ...props.sx,
      }}
    />
  );
};

export default TextField;
