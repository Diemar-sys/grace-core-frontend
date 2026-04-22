# Guía de Instalación Completa — Sistema GRACE

Cubre: Ubuntu Server + ERPNext + Frontend React + Servidor de Impresión Térmica.

---

## 1. Ubuntu Server

Instala Ubuntu Server 22.04 LTS (recomendado para ERPNext).

Durante instalación:
- Habilita OpenSSH
- Usuario sugerido: `diemar`
- Sin interfaz gráfica (server edition)

Actualiza tras instalación:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget nano
```

---

## 2. ERPNext (Frappe Bench)

Sigue la guía oficial de frappe-bench. Resumen:

```bash
# Dependencias base
sudo apt install -y python3-dev python3-pip python3-setuptools \
  python3-venv mariadb-server mariadb-client \
  redis-server nodejs npm yarn \
  xvfb libfontconfig wkhtmltopdf \
  libmysqlclient-dev

# Instalar bench
sudo pip3 install frappe-bench

# Crear bench y sitio
bench init frappe-bench --frappe-branch version-15
cd frappe-bench
bench new-site erp.local --mariadb-root-password TU_PASSWORD --admin-password TU_PASSWORD

# Instalar ERPNext
bench get-app erpnext --branch version-15
bench --site erp.local install-app erpnext

# Producción
sudo bench setup production diemar
sudo bench setup nginx
sudo supervisorctl restart all
```

> Guarda las contraseñas de MariaDB y admin en lugar seguro.

---

## 3. Frontend React (bake-data-frontend)

### Requisitos
```bash
sudo apt install -y nodejs npm
node --version  # necesita v18+
```

Si la versión es menor a 18:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### Clonar y configurar
```bash
git clone <URL_DEL_REPO> /home/diemar/bake-data-frontend
cd /home/diemar/bake-data-frontend
npm install
```

Crea el archivo de entorno:
```bash
cp .env.example .env
nano .env
```

Ajusta la URL del ERPNext:
```
VITE_API_URL=http://erp.local  # o la IP del servidor
```

### Build para producción
```bash
npm run build
```

Sirve el build con nginx o:
```bash
npm run preview
```

---

## 4. Servidor de Impresión Térmica

### Requisitos
- Impresora SICAR WL88S conectada por USB
- Python 3.10+

### Instalación automática
```bash
cd /home/diemar/bake-data-frontend/print-server
chmod +x setup.sh
sudo ./setup.sh
```

El script hace:
1. Deshabilita CUPS (interfiere con la térmica)
2. Instala Flask + python-escpos + pyusb
3. Crea regla udev para permisos en `/dev/usb/lp0`
4. Configura servicio systemd (arranque automático)

### Verificar que funciona
```bash
sudo systemctl status print-server
curl -X POST http://localhost:6789/imprimir \
  -H "Content-Type: application/json" \
  -d '{"items":[{"item_name":"Test","qty":1,"precio":10}],"cliente":"Test","pagos":[{"metodo":"Efectivo","monto":10}],"total":10,"cambio":0}'
```

Debe responder `{"ok": true}` e imprimir ticket de prueba.

---

## Troubleshooting impresora

| Problema | Fix |
|---|---|
| Ticket basura/PostScript | `sudo systemctl stop cups cups-browsed` |
| `Resource busy` | Igual que arriba |
| `/dev/usb/lp0` no existe | Reconectar USB, verificar con `lsusb \| grep SICAR` |
| `No module named flask` | `sudo pip3 install flask python-escpos pyusb --break-system-packages` |
| App cae a PDF en vez de térmica | `sudo systemctl start print-server` |

---

## Datos técnicos impresora

| Campo | Valor |
|---|---|
| Modelo | SICAR WL88S |
| idVendor | `0x20d1` |
| idProduct | `0x7007` |
| Endpoint OUT | `0x02` |
| Endpoint IN | `0x82` |
| Dispositivo | `/dev/usb/lp0` |
| Puerto servidor | `6789` |
