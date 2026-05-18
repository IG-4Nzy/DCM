import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  type SelectChangeEvent,
  FormHelperText,
} from '@mui/material';

export interface DropdownOption {
  label: string;
  value: string | number;
}

export interface DropdownProps {
  label: string;
  options: DropdownOption[];
  value: any;
  onChange: (value: any) => void;
  multiple?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  helperText?: string;
  error?: boolean;
  size?: 'small' | 'medium';
  sx?: any;
}

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;

const Dropdown: React.FC<DropdownProps> = ({
  label,
  options,
  value,
  onChange,
  multiple = false,
  required = false,
  fullWidth = true,
  disabled = false,
  helperText,
  error = false,
  size = 'medium',
  sx = {},
}) => {
  const handleChange = (event: SelectChangeEvent<any>) => {
    onChange(event.target.value);
  };

  // Ensure correct value format
  const displayValue = multiple
    ? Array.isArray(value)
      ? value
      : []
    : value || '';

  return (
    <FormControl
      fullWidth={fullWidth}
      required={required}
      error={error}
      disabled={disabled}
      size={size}
      sx={{
        width: fullWidth ? '100%' : { xs: '100%', sm: 300, md: 400 },
        '& .MuiOutlinedInput-root': {
          borderRadius: '8px',
          backgroundColor: '#fff',
        },
        ...sx,
      }}
    >
      <InputLabel>{label}</InputLabel>

      <Select
        multiple={multiple}
        value={displayValue}
        onChange={handleChange}
        label={label}
        renderValue={
          multiple
            ? (selected) =>
              options
                .filter((opt) =>
                  (selected as any[]).includes(opt.value)
                )
                .map((opt) => opt.label)
                .join(', ')
            : undefined
        }
        MenuProps={{
          disablePortal: true,
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'left',
          },
          transformOrigin: {
            vertical: 'top',
            horizontal: 'left',
          },
          slotProps: {
            paper: {
              style: {
                maxHeight:
                  ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
                width: 250,
              },
            },
          },
        }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
          >
            {multiple && (
              <Checkbox
                checked={
                  Array.isArray(displayValue) &&
                  displayValue.includes(option.value)
                }
              />
            )}

            <ListItemText primary={option.label} />
          </MenuItem>
        ))}
      </Select>

      {helperText && (
        <FormHelperText>{helperText}</FormHelperText>
      )}
    </FormControl>
  );
};

export default Dropdown;