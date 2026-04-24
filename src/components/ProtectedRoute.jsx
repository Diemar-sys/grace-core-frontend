import { Navigate, useLocation } from 'react-router-dom';
import { auth } from '../services/frappeAuth';
import { getRoleConfig } from '../config/roles';

function ProtectedRoute({ children }) {
  const user = auth.getUser();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;

  const config = getRoleConfig(user.role);

  // Normalizar pathname: eliminar trailing slash para evitar bypass con "/ruta/"
  const path = location.pathname.replace(/\/$/, '') || '/';

  if (!config.rutas.includes(path)) {
    return <Navigate to={config.inicio} replace />;
  }

  return children;
}

export default ProtectedRoute;
