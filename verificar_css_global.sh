#!/bin/sh
# verificar_css_global.sh — ninguna hoja de MÓDULO puede pisar el documento.
#
# La clase de bug que mata: un `body`, un `html` o un `*` sin acotar dentro de
# una hoja de pantalla. Vite la mete al bundle y la regla aplica en TODAS las
# pantallas, no solo en la suya. Ya pasó dos veces:
#   06-ago  pos/POSModals.css apagaba el body entero al imprimir → cualquier
#           otra impresión salía en hoja blanca.
#   08-sep  Login.css dejaba el documento en position:fixed + overflow:hidden
#           para toda la app, y su `*` era el único box-sizing que existía.
# El candado es `body:has(.lo-mio)`. Este script lo vigila sobre dist/, que es
# el CSS minificado de verdad — no sobre las fuentes.
#
# Corre solo desde preflight.sh, después del build. Suelto:  sh verificar_css_global.sh
set -u
CSS=$(find dist -name '*.css' 2>/dev/null | tr '\n' ' ')
[ -n "$CSS" ] || { echo "🔴 sin CSS en dist/ — corre pnpm build primero"; exit 2; }
fallas=0

# 🔴 El límite acepta '{' además de '}': el minificador mete estas reglas dentro
# de @media, así que el caracter previo suele ser '{'. Con el límite estrecho el
# chequeo no podía tronar y dejó pasar un mutante (08-sep).
prohibir() { # $1 = regex, $2 = qué significa
  if grep -oE "$1" $CSS >/dev/null 2>&1; then
    echo "  🔴 $2"; fallas=$((fallas+1))
  else
    echo "  ok  $2 — no está"
  fi
}

prohibir '(^|[{};])body\{[^}]*position:fixed'          'body{position:fixed} sin acotar'
prohibir '(^|[{};])html,body\{[^}]*overflow:hidden'    'html,body{overflow:hidden} sin acotar'
prohibir '(^|[{};])body \*\{visibility:hidden'         'body *{visibility:hidden} sin acotar'
prohibir '(^|[{};])body \*\{display:none'              'body *{display:none} sin acotar'

# Lo que SÍ debe seguir: el reset de caja vive en index.css desde el 08-sep.
if grep -qE '(^|[{};])\*\{box-sizing:border-box' $CSS; then
  echo "  ok  reset * {box-sizing} presente"
else
  echo "  🔴 se PERDIÓ el reset * {box-sizing:border-box}"; fallas=$((fallas+1))
fi

echo ""
if [ $fallas -eq 0 ]; then echo "✅ CSS global limpio"; else echo "❌ $fallas falla(s) de CSS global"; fi
exit $fallas
