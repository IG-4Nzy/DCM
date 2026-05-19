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
      slotProps={{
        inputLabel: {
          shrink: true,
        },
        htmlInput: {
          min: minDate,
          max: maxDate,
        },
      }}
      sx={{
        '& input[type="date"]::-webkit-calendar-picker-indicator': {
          filter: 'brightness(0)',
        },
        ...props.sx
      }}
      {...(props as any)}
    />
  );
};

export default DatePicker;
