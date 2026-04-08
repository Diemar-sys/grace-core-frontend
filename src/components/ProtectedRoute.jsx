import { Navigate } from 'react-router-dom';
import { auth } from '../services/frappeAuth';

/**
 * Envoltorio de rutas (Wrapper) para proteger rutas privadas en Reat Router.
 * Comprueba que la sesión del usuario exista localmente.
 * De lo contrario, redirige hacia `/login`.
 *
 * @param {Object} props - Propiedades.
 * @param {React.ReactNode} props.children - Componentes descendientes a renderizar si es válido.
 * @returns {JSX.Element} Elemento o Navigate hacia Login.
 */
function ProtectedRoute({ children }) {
  const user = auth.getUser();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

export default ProtectedRoute;