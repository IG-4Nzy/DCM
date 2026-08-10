// @ts-nocheck
export const colors = {
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  blue: '#2563EB',
  blueLight: '#EFF6FF',
  green: '#16A34A',
  greenLight: '#F0FDF4',
  amber: '#F59E0B',
  amberLight: '#FFFBEB',
  red: '#DC2626',
  redLight: '#FEF2F2',
  purple: '#7C3AED',
  purpleLight: '#F5F3FF',
};

export const cardSx = {
  bgcolor: colors.cardBg,
  border: `1px solid ${colors.border}`,
  borderRadius: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
  backgroundImage: 'none',
  transition: 'box-shadow 0.2s, transform 0.15s',
  '&:hover': {
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
};