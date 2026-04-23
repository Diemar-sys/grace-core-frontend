import { Navigate, useLocation } from 'react-router-dom';
import { auth } from '../services/frappeAuth';
import { getRoleConfig } from '../config/roles';

function ProtectedRoute({ children }) {
  const user = auth.getUser();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;

  const config = getRoleConfig(user.role);

  if (!config.rutas.includes(location.pathname)) {
    return <Navigate to={config.inicio} replace />;
  }

  return children;
}

export default ProtectedRoute;
