// =============================================================================
// ProtectedRoute — keeps signed-out people off the dashboards.
// =============================================================================
// This is CONVENIENCE, not security. It stops someone wandering onto a page
// they cannot use. The real protection is firestore.rules: even if somebody
// forced their way to /admin, every read and write would be refused by the
// database. Never rely on this component to protect data.
// =============================================================================

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader } from './UI';
import { ROLES } from '../lib/constants';

export default function ProtectedRoute({ children, allow = [] }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loader label="Checking your account…" />;

  if (!user) {
    // Remember where they were headed so sign-in can bounce them back.
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  }

  // An admin can open any dashboard — that is what makes "View As" work.
  if (allow.length && role !== ROLES.ADMIN && !allow.includes(role)) {
    const home = role === ROLES.EMPLOYEE ? '/employee' : '/dashboard';
    return <Navigate to={home} replace />;
  }

  return children;
}
