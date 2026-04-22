const PRINT_SERVER = 'http://localhost:6789';

export async function imprimirTicketTermico({ items, cliente, pagos, total, cambio = 0 }) {
  const res = await fetch(`${PRINT_SERVER}/imprimir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, cliente, pagos, total, cambio }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error al imprimir');
  return data;
}
