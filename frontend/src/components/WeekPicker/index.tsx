import React, { useState } from 'react';
import { Box, Popover, Button, IconButton } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickerDay, type PickerDayProps } from '@mui/x-date-pickers';
import { styled } from '@mui/material/styles';
import dayjs, { Dayjs } from 'dayjs';
import { getServerTime } from '../../helpers/time';
import isBetweenPlugin from 'dayjs/plugin/isBetween';
import isoWeekPlugin from 'dayjs/plugin/isoWeek';
import { MdCalendarMonth, MdChevronLeft, MdChevronRight } from 'react-icons/md';

dayjs.extend(isBetweenPlugin);
dayjs.extend(isoWeekPlugin);

interface WeekPickerProps {
  value: Dayjs | null;
  onChange: (newValue: Dayjs) => void;
}

const CustomPickerDay = styled(PickerDay, {
  shouldForwardProp: (prop) =>
    prop !== 'dayIsBetween' && prop !== 'isFirstDay' && prop !== 'isLastDay',
})<{
  dayIsBetween: boolean;
  isFirstDay: boolean;
  isLastDay: boolean;
}>(({ theme, dayIsBetween, isFirstDay, isLastDay }) => ({
  ...(dayIsBetween && {
    borderRadius: 0,
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.contrastText,
    '&:hover, &:focus': {
      backgroundColor: theme.palette.primary.main,
    },
  }),
  ...(isFirstDay && {
    borderTopLeftRadius: '50%',
    borderBottomLeftRadius: '50%',
  }),
  ...(isLastDay && {
    borderTopRightRadius: '50%',
    borderBottomRightRadius: '50%',
  }),
  ...(isFirstDay || isLastDay ? {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover, &:focus': {
      backgroundColor: theme.palette.primary.dark,
    },
  } : {}),
})) as React.ComponentType<CustomPickerDayProps>;

interface CustomPickerDayProps extends PickerDayProps {
  dayIsBetween: boolean;
  isFirstDay: boolean;
  isLastDay: boolean;
}

const WeekPicker: React.FC<WeekPickerProps> = ({ value, onChange }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'week-picker-popover' : undefined;

  const startOfWeek = value ? value.startOf('isoWeek') : getServerTime().startOf('isoWeek');
  const endOfWeek = value ? value.endOf('isoWeek') : getServerTime().endOf('isoWeek');

  const renderWeekPickerDay = (props: PickerDayProps) => {
    const { day: date } = props;

    if (!value) {
      return <PickerDay {...props} />;
    }

    const start = value.startOf('isoWeek');
    const end = value.endOf('isoWeek');

    const dayIsBetween = date.isBetween(start, end, 'day', '[]');
    const isFirstDay = date.isSame(start, 'day');
    const isLastDay = date.isSame(end, 'day');

    return (
      <CustomPickerDay
        {...props}
        dayIsBetween={dayIsBetween}
        isFirstDay={isFirstDay}
        isLastDay={isLastDay}
        sx={{
          mx: 0,
        }}
      />
    );
  };

  const displayFormat = 'DD MMM YYYY';
  const buttonText = value
    ? `${startOfWeek.format(displayFormat)} - ${endOfWeek.format(displayFormat)}`
    : 'Select Week';

  const handlePrevWeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange((value || getServerTime()).subtract(1, 'week'));
  };

  const handleNextWeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange((value || getServerTime()).add(1, 'week'));
  };

  return (
    <Box sx={{ gap: 1, display: "flex", alignItems: "center" }}>
      <IconButton onClick={handlePrevWeek} size="small">
        <MdChevronLeft />
      </IconButton>

      <Button
        variant="outlined"
        onClick={handleClick}
        startIcon={<MdCalendarMonth />}
        sx={{
          borderRadius: '8px',
          textTransform: 'none',
          color: '#333',
          borderColor: '#ccc',
          backgroundColor: '#fff',
          '&:hover': {
            borderColor: '#999',
            backgroundColor: '#f5f5f5',
          }
        }}
      >
        {buttonText}
      </Button>

      <IconButton onClick={handleNextWeek} size="small">
        <MdChevronRight />
      </IconButton>

      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        sx={{ mt: 1 }}
      >
        <Box sx={{ p: 1 }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateCalendar
              value={value}
              onChange={(newValue) => {
                if (newValue) {
                  onChange(newValue);
                  handleClose();
                }
              }}
              slots={{ day: renderWeekPickerDay }}
              showDaysOutsideCurrentMonth
            />
          </LocalizationProvider>
        </Box>
      </Popover>
    </Box>
  );
};

export default WeekPicker;
