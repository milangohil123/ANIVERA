import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type NormalizedRole } from '../../context/AuthContext';
import { StateView } from './StateView';

export interface ProtectedRouteProps {
  allowedRoles?: NormalizedRole[];
  requiredPermission?: string;
  requiredAnyPermission?: string[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  requiredPermission,
  requiredAnyPermission,
  children,
}) => {
  const { isAuthenticated, isLoading, role, hasPermission } = useAuth();
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
      return <Navigate to="/access-denied" state={{ reason: 'ROLE_DENIED' }} replace />;
    }
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <Navigate
        to="/access-denied"
        state={{
          reason: 'PERMISSION_DENIED',
          permission: requiredPermission,
          from: location.pathname,
        }}
        replace
      />
    );
  }

  if (requiredAnyPermission && requiredAnyPermission.length > 0) {
    const hasAny = requiredAnyPermission.some((perm) => hasPermission(perm));
    if (!hasAny) {
      return (
        <Navigate
          to="/access-denied"
          state={{
            reason: 'PERMISSION_DENIED',
            permission: requiredAnyPermission.join(', '),
            from: location.pathname,
          }}
          replace
        />
      );
    }
  }

  return <>{children}</>;
};
