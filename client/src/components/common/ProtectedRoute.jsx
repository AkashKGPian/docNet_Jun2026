import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-shell" style={{ gridTemplateColumns: '1fr' }}>
        <div className="auth-form-panel">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem', borderColor: 'var(--brand-ring)', borderTopColor: 'var(--brand)' }} />
            <p style={{ color: 'var(--ink-muted)', fontWeight: 600 }}>Loading DocNet…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const dashboardMap = {
      PATIENT: '/patient',
      DOCTOR: '/doctor',
      STAFF: '/staff',
    };
    return <Navigate to={dashboardMap[user.role] || '/login'} replace />;
  }

  return children;
};

export default ProtectedRoute;
