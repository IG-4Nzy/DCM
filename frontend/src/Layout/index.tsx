// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { styled, useTheme, type Theme, type CSSObject } from '@mui/material/styles';
import {
  Box,
  Toolbar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  ListItemButton,
  Divider,
  CssBaseline,
  Avatar,
  Tooltip,
  Badge,
  Typography
} from '@mui/material';
import MuiDrawer from '@mui/material/Drawer';
import MuiAppBar, { type AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import { Icons } from '../helpers/icons';

const {
  MenuIcon,
  LogoutIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} = Icons;
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';
import type { RootState } from '../store';
import wordings from '../helpers/wordings';
import { SIDEBAR_OPTIONS } from './constants';
import { hasAnyPrivilege } from '../helpers/authUtils';
import { ROUTE_CONSTANTS } from '../router/constant';
import request from '../services/request';
import { NotificationPollerProvider } from '../contexts/NotificationPollerContext';
import { getServerTime } from '../helpers/time';
import StickyNote from '../components/StickyNote';
import { MdStickyNote2 as StickyNoteIcon } from 'react-icons/md';

const drawerWidth = 240;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  background: '#fff',
  color: '#333',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
      ...openedMixin(theme),
      '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': closedMixin(theme),
    }),
  }),
);

const Layout: React.FC = () => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { username, role, isSuperuser } = useSelector((state: RootState) => state.auth);
  const [userInitials, setUserInitials] = React.useState<string>('?');
  const [userFullName, setUserFullName] = React.useState<string>('');
  const [stickyNoteEnabled, setStickyNoteEnabled] = React.useState<boolean>(false);
  const [unreadRoutes, setUnreadRoutes] = useState<Record<string, boolean>>({});
  const [serverTime, setServerTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      try {
        const formatter = new Intl.DateTimeFormat('en-GB', options);
        setServerTime(formatter.format(getServerTime().toDate()));
      } catch (e) {
        setServerTime(getServerTime().toDate().toLocaleString());
      }
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        if (!e.newValue) {
          // Token was removed (e.g., logged out from another tab)
          dispatch(logout());
        } else if (e.newValue !== e.oldValue && e.oldValue) {
          // Token was overwritten (logged in from another tab)
          localStorage.clear();
          window.location.href = '/login?reason=session_expired';
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [dispatch]);

  const fetchUnreadNotifications = async () => {
    try {
      const res = await request.get('/api/notifications/unread');
      setUnreadRoutes(res.data || {});
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    if (username) {
      fetchUnreadNotifications();
      const interval = setInterval(fetchUnreadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [username]);

  useEffect(() => {
    if (username) {
      const sendHeartbeat = async () => {
        try {
          await request.post('/api/users/heartbeat');
        } catch (err) {
          // silent ignore
        }
      };
      sendHeartbeat();
      const interval = setInterval(sendHeartbeat, 15000);
      return () => clearInterval(interval);
    }
  }, [username]);

  useEffect(() => {
    if (username) {
      const notifyVisit = async () => {
        const currentOption = SIDEBAR_OPTIONS.find(opt => location.pathname.startsWith(opt.route));
        if (currentOption) {
          try {
            await request.post('/api/notifications/visit', { route: currentOption.route });
            setUnreadRoutes(prev => ({ ...prev, [currentOption.route]: false }));
          } catch (err) {
            console.error('Error recording page visit:', err);
          }
        }
      };
      notifyVisit();
    }
  }, [location.pathname, username]);

  useEffect(() => {
    const fetchInitials = async () => {
      try {
        const res = await request.get('/api/auth/me');
        const { firstName, lastName, stickyNoteEnabled: snEnabled } = res.data;
        const f = (firstName || '').charAt(0).toUpperCase();
        const l = (lastName || '').charAt(0).toUpperCase();
        setUserInitials(l ? `${f}${l}` : f || (username || '?').charAt(0).toUpperCase());
        setUserFullName(`${firstName || ''} ${lastName || ''}`.trim() || username);
        setStickyNoteEnabled(!!snEnabled);
      } catch {
        setUserInitials((username || '?').charAt(0).toUpperCase());
        setUserFullName(username);
        setStickyNoteEnabled(false);
      }
    };
    fetchInitials();
  }, [username]);

  const [deployEnv, setDeployEnv] = useState<string>(() => {
    const raw = (import.meta.env.VITE_DEPLOY_ENV || '').toLowerCase().trim();
    return raw && !raw.includes('placeholder') ? raw : 'prod';
  });

  useEffect(() => {
    request.get('/api/config')
      .then(res => {
        if (res.data?.deploy) {
          setDeployEnv(res.data.deploy.toLowerCase().trim());
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const currentOption = SIDEBAR_OPTIONS.find(opt => location.pathname.startsWith(opt.route));
    if (currentOption) {
      if (!isSuperuser && currentOption.privileges && !hasAnyPrivilege(currentOption.privileges)) {
        const firstAvailable = SIDEBAR_OPTIONS.find(opt => isSuperuser || !opt.privileges || hasAnyPrivilege(opt.privileges));
        if (firstAvailable) {
          navigate(firstAvailable.route, { replace: true });
        }
      }
    } else if (location.pathname === '/') {
      const firstAvailable = SIDEBAR_OPTIONS.find(opt => isSuperuser || !opt.privileges || hasAnyPrivilege(opt.privileges));
      if (firstAvailable) {
        navigate(firstAvailable.route, { replace: true });
      }
    }
  }, [location.pathname, isSuperuser, navigate]);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <NotificationPollerProvider>
      <StickyNote />
      {deployEnv === 'test' && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 9998,
            overflow: 'hidden',
            opacity: 0.05,
            userSelect: 'none',
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'space-around',
            justifyContent: 'space-around',
            transform: 'rotate(-25deg) scale(1.5)'
          }}
        >
          {Array.from({ length: 60 }).map((_, i) => (
            <Typography
              key={i}
              sx={{
                fontSize: '2.5rem',
                fontWeight: 900,
                letterSpacing: '6px',
                color: '#000000',
                m: 6,
                whiteSpace: 'nowrap'
              }}
            >
              DCM
            </Typography>
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', textAlign: 'left', width: '100%', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{
              marginRight: 5,
              ...(open && { display: 'none' }),
            }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <label style={{ fontWeight: '500', fontSize: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {wordings.dataCentreManagement}
            </label>
            {deployEnv === 'test' && (
              <Box
                sx={{
                  backgroundColor: '#ed6c02',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  px: 1.2,
                  py: 0.3,
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  boxShadow: '0 2px 6px rgba(237, 108, 2, 0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  lineHeight: 1,
                  flexShrink: 0
                }}
              >
                Test
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                bgcolor: 'rgba(25, 118, 210, 0.05)',
                px: 1.5,
                py: 0.6,
                borderRadius: '8px',
                border: '1.5px solid rgba(25, 118, 210, 0.12)',
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                gap: 1
              }}
            >
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#1976d2', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Server Time (IST)
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#333', fontFamily: 'monospace' }}>
                {serverTime}
              </span>
            </Box>
            <label style={{ fontWeight: 'bold', color: '#666', fontSize: '0.875rem' }}>
              {wordings.welcome}, {userFullName} ({Array.isArray(role) ? role.join(", ") : role})
            </label>
            <Tooltip title="My Profile">
              <Avatar
                onClick={() => navigate(ROUTE_CONSTANTS.USER_PROFILE)}
                sx={{
                  width: 38,
                  height: 38,
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #1976d2 0%, #7c4dff 100%)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  border: '2px solid #e0e0e0',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  '&:hover': {
                    boxShadow: '0 2px 12px rgba(25,118,210,0.3)',
                    transform: 'scale(1.08)',
                  }
                }}
              >
                {userInitials}
              </Avatar>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        open={open}
        onMouseEnter={handleDrawerOpen}
        onMouseLeave={handleDrawerClose}
      >
        <DrawerHeader>
          <label style={{ fontWeight: 'bold', color: '#1976d2', flexGrow: 1, marginLeft: '16px', fontSize: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {wordings.dcm}
          </label>
          <IconButton onClick={handleDrawerClose} sx={{ color: '#1976d2' }}>
            {theme.direction === 'rtl' ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </DrawerHeader>
        <Divider />
        <Box sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <List>
            {
              SIDEBAR_OPTIONS?.map((option: any, index: number) => {
                if (option.superuserOnly && !isSuperuser) {
                  return null;
                }
                if (!isSuperuser && option.privileges && !hasAnyPrivilege(option.privileges)) {
                  return null;
                }

                let displayLabel = option.label;
                if (option.subItemPrivileges && Array.isArray(option.subItemPrivileges)) {
                  const allowedSubItems = option.subItemPrivileges
                    .filter((sub: any) => isSuperuser || hasAnyPrivilege(sub.privileges))
                    .map((sub: any) => sub.label);
                  
                  if (allowedSubItems.length > 0) {
                    if (allowedSubItems.length === 1) {
                      displayLabel = allowedSubItems[0];
                    } else if (allowedSubItems.length === 2) {
                      displayLabel = allowedSubItems.join(' & ');
                    } else {
                      const last = allowedSubItems.pop();
                      displayLabel = `${allowedSubItems.join(', ')} & ${last}`;
                    }
                  }
                }

                const isSelected = location.pathname === option.route;
                return (
                  <ListItem key={`sidebar-item-${index}`} disablePadding sx={{ display: 'block' }} title={displayLabel} >
                    <ListItemButton
                      onClick={() => navigate(option?.route)}
                      sx={{
                        minHeight: 48,
                        height: 'auto',
                        py: 1,
                        justifyContent: open ? 'initial' : 'center',
                        px: 2.5,
                        background: isSelected ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                        color: isSelected ? '#1976d2' : 'inherit',
                        borderRight: isSelected ? '3px solid #1976d2' : 'none',
                        '&:hover': {
                          background: isSelected ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0, 0, 0, 0.04)',
                        }
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 0,
                          mr: open ? 3 : 0,
                          justifyContent: 'center',
                          color: isSelected ? '#1976d2' : 'inherit'
                        }}
                      >
                        <Badge
                          variant="dot"
                          color="error"
                          invisible={!unreadRoutes[option.route]}
                          sx={{
                            '& .MuiBadge-badge': {
                              right: -2,
                              top: -2,
                              border: '1.5px solid #fff',
                              boxShadow: '0 0 6px rgba(239, 83, 80, 0.4)'
                            }
                          }}
                        >
                          <option.icon />
                        </Badge>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <span style={{
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            lineHeight: 1.25,
                            fontSize: '0.85rem'
                          }}>
                            {displayLabel}
                          </span>
                        }
                        sx={{ opacity: open ? 1 : 0, display: open ? 'block' : 'none', my: 0 }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })
            }
          </List>
        </Box>
        <Divider />

        <List>
          {stickyNoteEnabled && (
            <ListItem disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                onClick={() => window.dispatchEvent(new Event('openStickyNote'))}
                sx={{
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2.5,
                  color: '#5c5315'
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 3 : 0,
                    justifyContent: 'center',
                    color: '#f5b041'
                  }}
                >
                  <StickyNoteIcon size={24} />
                </ListItemIcon>
                <ListItemText primary="Sticky Note" sx={{ opacity: open ? 1 : 0, display: open ? 'block' : 'none' }} />
              </ListItemButton>
            </ListItem>
          )}
          <ListItem disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                minHeight: 48,
                justifyContent: open ? 'initial' : 'center',
                px: 2.5,
                color: 'error.main'
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 3 : 0,
                  justifyContent: 'center',
                  color: 'error.main'
                }}
              >
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary={wordings.logout} sx={{ opacity: open ? 1 : 0, display: open ? 'block' : 'none' }} />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100vh', background: '#f5f7fa', boxSizing: 'border-box' }}>
        <DrawerHeader />
        <Outlet />
      </Box>
    </Box>
    </NotificationPollerProvider>
  );
}

export default Layout;
