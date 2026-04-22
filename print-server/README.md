# Servidor de Impresión Térmica — SICAR WL88S

## Instalación en PC nueva

```bash
cd print-server
chmod +x setup.sh
./setup.sh
```

El script hace todo automático:
- Deshabilita CUPS (interfiere con la térmica)
- Instala Flask + python-escpos + pyusb
- Crea regla udev para permisos permanentes en /dev/usb/lp0

## Iniciar servidor

El `setup.sh` configura un servicio que arranca solo al prender la PC.
No necesitas hacer nada más.

Si necesitas manejarlo manualmente:
```bash
sudo systemctl start print-server    # iniciar
sudo systemctl stop print-server     # detener
sudo systemctl restart print-server  # reiniciar
sudo journalctl -u print-server -f   # ver logs en vivo
```

## Verificar impresora conectada

```bash
ls /dev/usb/lp0
lsusb | grep SICAR
```

## Troubleshooting

| Problema                    | Causa                      | Fix                                                                   |
|-----------------------------|----------------------------|-----------------------------------------------------------------------|
| Ticket basura/PostScript    | CUPS activo                | `sudo systemctl stop cups cups-browsed`                               |
| `Resource busy`             | CUPS tomó el USB           | Igual que arriba                                                      |
| `No such file /dev/usb/lp0` | Impresora desconectada     | Reconectar USB                                                        |
| `No module named flask`     | Faltan deps en root        | `sudo pip3 install flask python-escpos pyusb --break-system-packages` |
| App cae a PDF               | Servidor no está corriendo | Iniciar `sudo python3 print_server.py`                                |

## Datos de la impresora

- Marca: SICAR WL88S
- idVendor: `0x20d1`
- idProduct: `0x7007`
- Endpoint OUT: `0x02` / IN: `0x82`
- Dispositivo: `/dev/usb/lp0`
