// src/components/ReposicionInsumos.tsx
// La otra cara de Envío a Sucursal: no lo que ya mandé, sino lo que me falta.
//
// El saldo de bolsas de una sucursal es ficción —solo hay entradas, usar una no
// genera movimiento—, así que el saldo nunca baja. Lo que sí es real es cada
// cuánto se repone, y comparar ese ritmo contra los días transcurridos contesta
// la pregunta sin que nadie capture nada nuevo, que es la parte que nunca sale.
import { useEffect, useState } from 'react';
import { inventory } from '../services/frappeInventory';
import type { Reposicion, RenglonReposicion } from '../services/frappeInventory';

type Estado = RenglonReposicion['estado'];

const BADGE: Record<Estado, string> = {
  vencido: 'bad',
  pronto: 'warn',
  al_dia: 'ok',
  sin_ritmo: 'info',
};
const ETIQUETA: Record<Estado, string> = {
  vencido: 'Ya le tocaba',
  pronto: 'Le toca pronto',
  al_dia: 'Al día',
  sin_ritmo: 'Sin ritmo todavía',
};

const dias = (n: number) => (n === 1 ? '1 día' : `${n} días`);
const fechaCorta = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });

interface Props {
  soloPendientes?: boolean;
  onTotal?: (total: number) => void;
}

/** El filtro y el conteo viven en la barra de la página, junto a los del
 *  historial: son la misma barra, como en Compras. Aquí solo se pinta. */
export default function ReposicionInsumos({ soloPendientes = true, onTotal }: Props) {
  const [datos, setDatos] = useState<Reposicion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    inventory.getReposicion(soloPendientes)
      .then((d) => {
        if (!vigente) return;
        setDatos(d);
        // la página lo pinta en la opción del dropdown, como los conteos de Compras
        if (onTotal) onTotal(d.renglones.length);
      })
      .catch((err: any) => { if (vigente) { setError(err.message); setDatos(null); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [soloPendientes, onTotal]);

  const renglones = datos?.renglones ?? [];

  // Una tarjeta por sucursal: la pregunta es «¿a quién le mando?», y una lista
  // plana de 67 renglones obliga a reconstruir esa agrupación de cabeza.
  const porSucursal = new Map<string, RenglonReposicion[]>();
  for (const r of renglones) {
    if (!porSucursal.has(r.sucursal)) porSucursal.set(r.sucursal, []);
    porSucursal.get(r.sucursal)!.push(r);
  }

  if (error) {
    return <p className="empty-state">No se pudo medir la reposición: {error}</p>;
  }

  return (
    <>
      {!!datos?.sin_tipo?.length && (
        <p className="rep-fuera"
          title="Reciben insumo pero no tienen tipo de almacén, así que no se sabe si son punto de entrega.">
          Fuera del cálculo: {datos.sin_tipo.map((w) => w.replace(' - PG', '')).join(', ')}
        </p>
      )}

      {cargando && <p className="empty-state">Midiendo el ritmo…</p>}

      {!cargando && !renglones.length && (
        <p className="empty-state">
          Ninguna sucursal se pasó de su ritmo de reposición.
        </p>
      )}

      {!cargando && [...porSucursal.entries()].map(([sucursal, filas]) => (
        <div className="rep-bloque" key={sucursal}>
          <h3 className="rep-titulo">
            {sucursal} <span className="ped-badge info">{filas.length} insumos</span>
          </h3>
          <div className="table-container">
            <table className="sys-table">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th className="cell-right">Suele mandarse</th>
                  <th className="cell-right">Cada</th>
                  <th className="cell-right">Última vez</th>
                  <th className="cell-right">Van</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r) => (
                  <tr key={r.clave}>
                    <td>{r.producto}</td>
                    <td className="cell-right">{r.cantidad_tipica.toLocaleString('es-MX')}</td>
                    <td className="cell-right">{r.ritmo ? dias(r.ritmo) : '—'}</td>
                    <td className="cell-right">{fechaCorta(r.ultima)}</td>
                    <td className="cell-right"><strong>{dias(r.dias)}</strong></td>
                    <td>
                      <span className={`ped-badge ${BADGE[r.estado]}`}>{ETIQUETA[r.estado]}</span>
                      {r.envios === 1 && (
                        <span className="rep-hint">un solo envío en la historia</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
