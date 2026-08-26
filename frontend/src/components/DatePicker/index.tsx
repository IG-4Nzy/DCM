// @ts-nocheck
import React from 'react';
import TextField from '../TextField';
import { type TextFieldProps as MuiTextFieldProps } from '@mui/material';

export interface DatePickerProps extends Omit<MuiTextFieldProps, 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({ 
  label, 
  value, 
  onChange, 
  minDate,
  maxDate,
  ...props 
}) => {
  return (
    <TextField
      type="date"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      InputLabelProps={{ shrink: true }}
      {...(props as any)}
      slotProps={{
        inputLabel: {
          shrink: true,
          ...props.slotProps?.inputLabel,
          ...props.InputLabelProps,
        },
        htmlInput: {
          min: minDate,
          max: maxDate,
          ...props.slotProps?.htmlInput,
          ...props.inputProps,
        },
        ...props.slotProps,
      }}
      sx={{
        '& input[type="date"]::-webkit-calendar-picker-indicator': {
          filter: 'brightness(0)',
        },
        ...props.sx
      }}
    />
  );
};

export default DatePicker;
