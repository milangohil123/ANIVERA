import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type NormalizedRole } from '../../context/AuthContext';
import { StateView } from './StateView';

export interface ProtectedRouteProps {
  allowedRoles?: NormalizedRole[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  children,
}) => {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFB]">
        <StateView state="loading" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(role)) {
      return <Navigate to="/access-denied" replace />;
    }
  }

  return <>{children}</>;
};

