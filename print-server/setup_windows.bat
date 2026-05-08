@echo off
echo === 1. Creando entorno virtual Python ===
python -m venv venv
if %errorlevel% neq 0 (
    echo Error: Asegurate de tener Python (y Pip) instalado y agregado al PATH de Windows.
    pause
    exit /b %errorlevel%
)

echo === 2. Instalando dependencias ===
call venv\Scripts\activate.bat
pip install -r requirements.txt

echo === 3. Creando acceso directo de inicio automatico ===
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set VBS_DST=%STARTUP_DIR%\grace_print_server.vbs

echo Set WshShell = CreateObject("WScript.Shell") > "%VBS_DST%"
echo WshShell.Run chr(34) ^& "%~dp0venv\Scripts\pythonw.exe" ^& chr(34) ^& " " ^& chr(34) ^& "%~dp0print_server.py" ^& chr(34), 0, False >> "%VBS_DST%"

echo === Configuracion terminada ===
echo.
echo [IMPORTANTE] La impresora necesita estar instalada en el "Panel de Control > Dispositivos e Impresoras" con el nombre exacto "SICAR".
echo Si le pusiste otro nombre a la impresora, edita la variable PRINTER_NAME en la linea 20 del archivo print_server.py.
echo.
echo El servidor se iniciara silenciosamente cada vez que enciendas la computadora.
echo.
echo Iniciando servidor de prueba en segundo plano ahora...
cscript //nologo "%VBS_DST%"
echo.
echo ¡Listo! Ya deberias poder imprimir desde el navegador. 
echo (El servidor corre como pythonw.exe en el Administrador de Tareas)
pause
