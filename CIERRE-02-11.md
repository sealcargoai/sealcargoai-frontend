# Cierre 02-11 — auditoría integral (frontend)

Versión: `2026.11.02-a`. Base: `aad9829` (producción al 2 de noviembre de 2026).
Backend correspondiente: `sealcargoai-backend`, misma versión (ver su `CIERRE-02-11.md`).

## Defectos corregidos (causa raíz)

| # | Defecto observado | Causa raíz | Corrección |
|---|---|---|---|
| D1 | Tras un cálculo, «48» recibía «no respondo preguntas abiertas»; «son 48» proponía «la cantidad es 6»; «sí» caía al mensaje genérico; «para el cálculo» sin artículo repetía la pregunta | Un número suelto no entraba en ninguna regla; el ejemplo estaba fijo («6», «600»); la respuesta «sí» no estaba prevista; el cálculo no guardaba su empaque | `nextSpec`: número suelto → pregunta (cálculo o caso); ejemplo con el número escrito; «sí/no» repite la pregunta; `calcLabel` usa el empaque («¿y para 48 cajas?») |
| D2 | Un número suelto sin cálculo previo se ignoraba | Igual que D1 | Pregunta «¿cantidad o característica?» (producto con medidas) o «¿cantidad o presupuesto?» (sin medidas). Nada cambia |
| D3 | «¿cuánto es 10 x 650?» recibía el párrafo de costos; con «no cambies nada…» no se respondía | No había regla de aritmética simple | `plainArithmetic` (dos números y un operador, al final de una pregunta); se responde también dentro de «no cambies nada» |
| D4 | Un mensaje no entendido («make it 12…») decía «incluye una negación, una condición o una pregunta» | Un solo texto para todas las dudas | Si la duda es solo una parte no entendida, se cita esa parte |
| D5 | Leyenda de costos sumaba 101% y mostraba FOB 62% junto a 61% del otro gráfico | Cada gráfico/tabla/PDF/Excel redondeaba por su cuenta | `shareValues`/`lineShares` (resto mayor) en página, leyenda, PDF y Excel |
| D6 | Con 1,615 caracteres que terminan en espacio: contador 1,615 y «te pasaste por 114» | Contador con texto crudo; límite y aviso con texto recortado | Contador, aviso y validación cuentan el texto recortado (inicio y formulario) |
| D7 | «proveedor mejor clasificado», «contactar las mejores opciones», «Un ejecutivo te confirma el costo», título «costo total» sin flete, flete sin origen | Textos | «coincidencias de búsqueda para investigar», «las que quieras investigar», «no es cotización ni costo final», «Estimación preliminar…», flete «tarifa referencial de SEAL, no es cotización de naviera» |
| D8 | «no cambies la cantidad, el presupuesto es US$7,000» no cambiaba el presupuesto («Como pediste, no cambié el presupuesto») | El objeto de la prohibición seguía después de la coma | El objeto termina donde otra cláusula da valor a otro campo |
| D9 | `/suppliers` en una pestaña nueva decía «La plataforma no devolvió datos» y ofrecía enviar un caso sin producto | Sin búsqueda se usaba el estado de «plataforma bloqueada» | Estado «No hay una búsqueda abierta en esta pestaña» con acceso al formulario, sin envío |
| D10 | El diálogo de contacto decía «No necesitas buscar proveedores» después de una búsqueda | Texto único | Esa frase solo en inicio y chat |
| D11 | La prueba e2e de sandbox fallaba de forma intermitente (ronda 3 del primer candidato) | `server.kill()` detenía solo `npx`; el servidor `vite preview` quedaba vivo y otro arranque podía chocar con su puerto | Grupo de procesos propio, cierre del grupo completo y espera a que ESTE servidor responda |

## Pruebas

- `tests/cierre-02-11.test.ts` (25 casos; 24 fallan sobre `aad9829`).
- Suite completa `npx vitest run`, tipos estrictos, build, `node e2e/run-e2e.mjs` (sandbox).
- Recorrido en navegador con backend local (correo simulado, búsqueda ficticia): ver informe de entrega.
