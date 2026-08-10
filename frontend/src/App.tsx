// @ts-nocheck
import React, { useEffect } from 'react';
import AppRouter from './router/AppRouter';
import { syncServerTime } from './helpers/time';

const App: React.FC = () => {
  useEffect(() => {
    syncServerTime();
  }, []);

  return (
    <AppRouter />
  );
};

export default App;
