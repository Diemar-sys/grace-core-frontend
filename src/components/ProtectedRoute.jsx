import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { auth } from '../services/frappeAuth';
import { getRoleConfig } from '../config/roles';
import { useAutoUppercase } from '../hooks/useAutoUppercase';
import { loadAppConfig } from '../services/appConfig';
import { loadSucursalesConfig } from '../services/sucursalesConfig';

function ProtectedRoute({ children }) {
  useAutoUppercase();
  const user = auth.getUser();
  const location = useLocation();

  // Pre-cargar configs si session activa (cubre refresh página sin pasar por login).
  useEffect(() => {
    if (!user) return;
    Promise.all([loadAppConfig(), loadSucursalesConfig()]).catch(() => { });
    // `user` es un objeto nuevo en cada render (auth.getUser()): depender de el
    // recargaria las configs sin parar. El email es el primitivo estable que de
    // verdad identifica la sesion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

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
