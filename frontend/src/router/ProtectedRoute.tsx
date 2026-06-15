import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { ROUTE_CONSTANTS } from './constant';
import { logout } from '../store/authSlice';
import {jwtDecode} from "jwt-decode";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, token } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  
  useEffect(() => {
    if (token) {
      try {
        jwtDecode(token);
      } catch (error) {
        // If token is invalid
        dispatch(logout());
      }
    }
  }, [token, dispatch]);

  if (!isAuthenticated || !token) {
    return <Navigate to={ROUTE_CONSTANTS.LOGIN} replace />;
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;
