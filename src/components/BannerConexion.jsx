import { WifiOff, Wifi } from "lucide-react";
import { useConexion } from "../hooks/useConexion";
import "../styles/BannerConexion.css";

/**
 * Aviso de red caída, para cualquier pantalla.
 *
 * Se monta UNA vez en App.jsx, arriba de las rutas, y no dentro de Layout: el
 * Panel principal —donde la gente se queda todo el día— trae su propio topbar y
 * nunca pasó por Layout, así que ahí no salía nada. Montarlo en la raíz también
 * lo hace inmune a la próxima pantalla que se olvide de envolverse en Layout.
 *
 * Sin esto, quedarse sin WiFi se veía como un error de programador en pantalla
 * («Cannot read properties of null»).
 */
export default function BannerConexion() {
  const estado = useConexion();
  if (estado === "ok") return null;

  const sinRed = estado === "sin-conexion";
  return (
    <div
      className={`banner-conexion ${sinRed ? "banner-sin-red" : "banner-volvio"}`}
      role={sinRed ? "alert" : "status"}
    >
      {sinRed ? <WifiOff size={15} aria-hidden="true" /> : <Wifi size={15} aria-hidden="true" />}
      <span>
        {sinRed
          ? "Sin conexión. Revisa el WiFi — lo que guardes ahora puede no registrarse."
          : "Ya hay conexión. Recarga para seguir trabajando."}
      </span>
      {!sinRed && (
        <button type="button" onClick={() => window.location.reload()}>
          Recargar
        </button>
      )}
    </div>
  );
}
