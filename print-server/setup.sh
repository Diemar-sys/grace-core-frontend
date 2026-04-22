#!/bin/bash
# Setup impresora térmica SICAR WL88S
set -e

# Usuario que correrá el servicio (quien ejecuta sudo, no root)
RUN_USER="${SUDO_USER:-$USER}"

echo "=== 1. Deshabilitando CUPS ==="
sudo systemctl stop cups cups-browsed 2>/dev/null || true
sudo systemctl disable cups cups-browsed 2>/dev/null || true

echo "=== 2. Regla udev para permisos permanentes ==="
echo 'SUBSYSTEM=="usbmisc", ATTRS{idVendor}=="20d1", ATTRS{idProduct}=="7007", MODE="0666"' \
  | sudo tee /etc/udev/rules.d/99-sicar-thermal.rules
sudo udevadm control --reload-rules
sudo udevadm trigger
echo "  (reconecta la impresora si ya estaba conectada)"

echo "=== 3. Creando entorno virtual Python ==="
VENV_PATH="/opt/print-server-venv"
sudo python3 -m venv "$VENV_PATH"
sudo "$VENV_PATH/bin/pip" install --quiet flask python-escpos pyusb
sudo chown -R "$RUN_USER":"$RUN_USER" "$VENV_PATH"

echo "=== 4. Configurando servicio systemd ==="
SCRIPT_PATH="$(realpath "$(dirname "$0")/print_server.py")"
cat > /tmp/print-server.service << EOF
[Unit]
Description=Servidor impresion termica GRACE
After=network.target

[Service]
ExecStart=${VENV_PATH}/bin/python3 ${SCRIPT_PATH}
Restart=always
User=${RUN_USER}

[Install]
WantedBy=multi-user.target
EOF
sudo mv /tmp/print-server.service /etc/systemd/system/print-server.service
sudo systemctl daemon-reload
sudo systemctl enable print-server
sudo systemctl start print-server

echo ""
echo "LISTO. Servicio corriendo como '${RUN_USER}' (no root)."
echo "Comandos utiles:"
echo "  sudo systemctl status print-server   # ver estado"
echo "  sudo systemctl restart print-server  # reiniciar"
echo "  sudo journalctl -u print-server -f   # ver logs"
