// @ts-nocheck
import { colors } from './constants';

export const getChecklistPct = (status: string): number => {
  if (status === 'Completed') return 100;
  if (status === 'Draft') return 60;
  return 0;
};

export const getStatusColor = (status: string) => {
  if (status === 'Completed') return { color: colors.green, bg: colors.greenLight };
  if (status === 'Draft') return { color: colors.amber, bg: colors.amberLight };
  return { color: colors.red, bg: colors.redLight };
};

export const getPriorityColor = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case 'high': return colors.red;
    case 'medium': return colors.amber;
    case 'low': return colors.green;
    default: return colors.textMuted;
  }
};
