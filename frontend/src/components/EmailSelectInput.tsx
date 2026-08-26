import React, { useEffect, useState } from 'react';
import { Autocomplete, Chip } from '@mui/material';
import TextField from '../components/TextField';
import request from '../services/request';

interface EmailSelectInputProps {
  value: string;
  onChange: (val: string) => void;
  department: string;
  module?: string;
  placeholder?: string;
  size?: 'small' | 'medium';
  height?: string;
  width?: string;
}

const EmailSelectInput: React.FC<EmailSelectInputProps> = ({
  value,
  onChange,
  department,
  module,
  placeholder = "Mails...",
  size = "small",
  height,
  width = '210px'
}) => {
  const [options, setOptions] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');

  // Fetch saved default emails
  useEffect(() => {
    const fetchSavedEmails = async () => {
      try {
        const url = module ? `/api/mail-config/saved-emails?module=${encodeURIComponent(module)}` : '/api/mail-config/saved-emails';
        const res = await request.get(url);
        if (Array.isArray(res.data)) {
          setOptions(res.data);
        }
      } catch (err) {
        console.error("Error fetching saved emails:", err);
      }
    };
    fetchSavedEmails();
  }, [module]);

  // Fetch last sent emails for department to initialize if value is empty
  useEffect(() => {
    const fetchLastSent = async () => {
      if (!department) return;
      try {
        const res = await request.get(`/api/mail-config/last-sent?department=${encodeURIComponent(department)}`);
        if (res.data && res.data.emails) {
          // Only set if current value is empty/falsy
          if (!value) {
            onChange(res.data.emails);
          }
        }
      } catch (err) {
        console.error("Error fetching last sent emails:", err);
      }
    };
    fetchLastSent();
  }, [department]);

  // Convert comma-separated string to array for Autocomplete
  const selectedValues = value
    ? value.split(',').map((e: string) => e.trim()).filter(Boolean)
    : [];

  return (
    <Autocomplete
      multiple
      freeSolo
      size={size}
      options={options}
      value={selectedValues}
      onChange={(event: any, newValue: any) => {
        const joined = newValue.join(', ');
        onChange(joined);
      }}
      inputValue={inputValue}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      onBlur={() => {
        if (inputValue.trim()) {
          const newEmails = inputValue
            .split(',')
            .map((e: string) => e.trim())
            .filter(Boolean);
          if (newEmails.length > 0) {
            const updated = [...selectedValues, ...newEmails];
            onChange(Array.from(new Set(updated)).join(', '));
            setInputValue('');
          }
        }
      }}
      renderValue={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip
            key={index}
            label={option}
            size="small"
            {...getTagProps({ index })}
            sx={{ height: '22px', fontSize: '10px' }}
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={selectedValues.length === 0 ? placeholder : ""}
          sx={{
            width: '100%',
            '& .MuiInputBase-root': {
              height: height || 'auto',
              minHeight: '32px',
              fontSize: '11px',
              padding: '2px 6px !important',
              display: 'flex',
              flexWrap: 'wrap',
              overflow: 'hidden'
            },
            '& .MuiAutocomplete-input': {
              padding: '2px 4px !important',
              fontSize: '11px'
            }
          }}
        />
      )}
      sx={{
        width: width,
        backgroundColor: '#ffffff',
        borderRadius: '8px'
      }}
    />
  );
};

export default EmailSelectInput;
