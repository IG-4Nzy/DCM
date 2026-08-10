// @ts-nocheck
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App';
import './index.css';
import { ThemeProvider, createTheme, CssBaseline, Dialog, Modal } from '@mui/material';



// LocalStorage Interceptor for page-level state cleanup
(function() {
  const originalGetItem = window.localStorage.getItem;
  const originalSetItem = window.localStorage.setItem;
  const originalRemoveItem = window.localStorage.removeItem;

  const EXCLUDED_KEYS = ['token', 'role', 'username', 'displayName', 'PRIVILEGES', 'isSuperuser', 'user', 'bms_checklists', 'bms_checklist_template', '__path_keys_map', '__current_saved_path'];

  const getPathKeysMap = (): Record<string, string[]> => {
    try {
      const saved = originalGetItem.call(window.localStorage, '__path_keys_map');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  };

  const setPathKeysMap = (map: Record<string, string[]>) => {
    try {
      originalSetItem.call(window.localStorage, '__path_keys_map', JSON.stringify(map));
    } catch (e) {}
  };

  const handlePathChange = (newPath: string) => {
    try {
      const currentSavedPath = originalGetItem.call(window.localStorage, '__current_saved_path') || '';
      if (currentSavedPath && currentSavedPath !== newPath) {
        const keyMap = getPathKeysMap();
        const keysToRemove = new Set<string>();

        Object.entries(keyMap).forEach(([path, keys]) => {
          if (path !== newPath) {
            keys.forEach(key => keysToRemove.add(key));
            delete keyMap[path];
          }
        });

        keysToRemove.forEach(key => {
          if (!EXCLUDED_KEYS.includes(key)) {
            originalRemoveItem.call(window.localStorage, key);
          }
        });

        setPathKeysMap(keyMap);
      }
      originalSetItem.call(window.localStorage, '__current_saved_path', newPath);
    } catch (e) {
      console.error('Error in handlePathChange:', e);
    }
  };

  // Intercept setItem to register keys under current pathname
  window.localStorage.setItem = function(key: string, value: string) {
    try {
      const currentPath = window.location.pathname;
      if (!EXCLUDED_KEYS.includes(key)) {
        const keyMap = getPathKeysMap();
        if (!keyMap[currentPath]) {
          keyMap[currentPath] = [];
        }
        if (!keyMap[currentPath].includes(key)) {
          keyMap[currentPath].push(key);
          setPathKeysMap(keyMap);
        }
      }
    } catch (e) {}
    return originalSetItem.call(this, key, value);
  };

  // Intercept history functions to detect SPA routing changes
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function(...args) {
    const result = originalPushState.apply(this, args);
    handlePathChange(window.location.pathname);
    return result;
  };

  window.history.replaceState = function(...args) {
    const result = originalReplaceState.apply(this, args);
    handlePathChange(window.location.pathname);
    return result;
  };

  window.addEventListener('popstate', () => {
    handlePathChange(window.location.pathname);
  });

  // Run immediately on load
  handlePathChange(window.location.pathname);
})();

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f4f6f8',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: {
          '&.MuiDialog-paperWidthXs': {
            maxWidth: '650px !important',
          },
          '&.MuiDialog-paperWidthSm': {
            maxWidth: '900px !important',
          },
          '&.MuiDialog-paperWidthMd': {
            maxWidth: '1200px !important',
          },
          '&.MuiDialog-paperWidthLg': {
            maxWidth: '1500px !important',
          },
          '&.MuiDialog-paperWidthXl': {
            maxWidth: '1800px !important',
          },
        },
      },
    },
  },
});

import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
