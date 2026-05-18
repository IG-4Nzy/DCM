import React, { useState } from 'react';
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
  CssBaseline
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
  const { username, role } = useSelector((state: RootState) => state.auth);

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
    <Box sx={{ display: 'flex', textAlign: 'left' }}>
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
          <label style={{ flexGrow: 1, fontWeight: '500', fontSize: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {wordings.dataCentreManagement}
          </label>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <label style={{ fontWeight: 'bold', color: '#666', fontSize: '0.875rem' }}>
              {wordings.welcome}, {username} ({role})
            </label>
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" open={open}>
        <DrawerHeader>
          <label style={{ fontWeight: 'bold', color: '#1976d2', flexGrow: 1, marginLeft: '16px', fontSize: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {wordings.dcm}
          </label>
          <IconButton onClick={handleDrawerClose}>
            {theme.direction === 'rtl' ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </DrawerHeader>
        <Divider />
        <List>
          {
            SIDEBAR_OPTIONS?.map((option, index) => {
              if (option.privileges && !hasAnyPrivilege(option.privileges)) {
                return null;
              }
              const isSelected = location.pathname === option.route;
              return (
                <ListItem key={`sidebar-item-${index}`} disablePadding sx={{ display: 'block' }} title={option.label} >
                  <ListItemButton
                    onClick={() => navigate(option?.route)}
                    sx={{
                      minHeight: 48,
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
                        mr: open ? 3 : 'auto',
                        justifyContent: 'center',
                        color: isSelected ? '#1976d2' : 'inherit'
                      }}
                    >
                      <option.icon />
                    </ListItemIcon>
                    <ListItemText primary={option.label} sx={{ opacity: open ? 1 : 0 }} />
                  </ListItemButton>
                </ListItem>
              );
            })
          }
        </List>

        <Box sx={{ flexGrow: 1 }} />
        <Divider />

        <List>
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
                  mr: open ? 3 : 'auto',
                  justifyContent: 'center',
                  color: 'error.main'
                }}
              >
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary={wordings.logout} sx={{ opacity: open ? 1 : 0 }} />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, minHeight: '100vh', background: '#f5f7fa', boxSizing: 'border-box' }}>
        <DrawerHeader />
        <Outlet />
      </Box>
    </Box>
  );
}

export default Layout;
