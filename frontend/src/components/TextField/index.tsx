// @ts-nocheck
import React from 'react';
import { TextField as MuiTextField, type TextFieldProps as MuiTextFieldProps, Box } from '@mui/material';

interface CustomTextFieldProps extends Omit<MuiTextFieldProps, 'helperText'> {
  showCount?: boolean;
  helperText?: React.ReactNode;
}

const TextField: React.FC<CustomTextFieldProps> = ({ showCount, helperText, ...props }) => {
  const isTextArea = props.multiline || props.rows || props.maxRows || props.minRows;
  const maxLimit = isTextArea ? 200 : 100;

  const htmlInputProps = {
    maxLength: props.inputProps?.maxLength !== undefined ? props.inputProps.maxLength : maxLimit,
    ...props.inputProps,
    ...props.slotProps?.htmlInput,
  };

  const slotProps = {
    ...props.slotProps,
    htmlInput: htmlInputProps,
  };

  const inputProps = {
    maxLength: htmlInputProps.maxLength,
    ...props.inputProps,
  };

  const currentLength = typeof props.value === 'string' ? props.value.length : 0;
  const maxLength = htmlInputProps.maxLength;

  let renderedHelperText = helperText;
  if (showCount && maxLength) {
    renderedHelperText = (
      <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', m: 0 }}>
        <Box component="span" sx={{ mr: 1 }}>{helperText || ''}</Box>
        <Box component="span" sx={{ whiteSpace: 'nowrap', marginLeft: 'auto' }}>{currentLength}/{maxLength}</Box>
      </Box>
    );
  }

  return (
    <MuiTextField
      {...props}
      inputProps={inputProps}
      slotProps={slotProps}
      helperText={renderedHelperText}
      sx={{
        width: props.fullWidth ? '100%' : { xs: '100%', sm: 300, md: 400 }, // Responsive width
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


