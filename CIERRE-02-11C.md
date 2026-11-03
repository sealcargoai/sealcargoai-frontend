# Cierre 02-11c — frontend

Versión `2026.11.02-c`. Base: `58f9303` (= producción 911a9aa en contenido).

| Área | Defecto | Causa raíz | Corrección | Prueba |
|---|---|---|---|---|
| QA | Visitantes con «Demo», «prueba» o example.com contaban como QA en analítica | `TEST_RE` en `funnel.ts` | Solo `?qa=1` explícito | `cierre-02-11c.test.ts` C5 |
| Costos | Q64,140 en pantalla/informe/caso/PDF y Q64,140.15 en filas | Cada vista formateaba `totalCost` a su manera | Un total: suma de filas impresas en centavos (`formatQTotal`, `groupQ`, `perUnitQ`, `totalSummary`) en pantalla, barra lateral, informe, resumen del caso, PDF y Excel | `costs-02-11c.test.ts` (lee el PDF y el Excel generados) |
| Costos | Por unidad < Q1 se mostraba Q0.00 (detectado en la revisión independiente) | Redondeo a 2 decimales | Conserva decimales significativos | `costs-02-11c.test.ts` |
| Chat | «¿Cuánto es 12 × 24? Para el caso son 48 …» daba el párrafo de costos o «no cambié nada» sin responder | La aritmética solo se reconocía al final del mensaje | Responde el cálculo y pregunta por el número (cantidad o presupuesto; una medida no se pregunta); con «no cambies» lo deja en espera | C2, C6 |
| Chat | Dos cantidades o presupuestos distintos en una frase: mensaje genérico | Sin detector de contradicción | «Indicaste dos cantidades distintas (10 y 12)…», nada se aplica | C3 |
| Textos | «Calificación de Producto», «mejor ubicados», «Proveedor Seleccionado», servicios sin aclarar que se cotizan, claves de categoría en Excel | Textos / clave interna | Textos revisados ES/EN; `productText` en Excel | `cierre-02-11c.test.ts` T |
| Informe | Se decía «se descargó» aunque el PDF no se generara; sin mensaje para 503 de QA | `downloadReportNow` ignoraba errores | Devuelve si se generó; mensajes según el resultado | revisión de código + rondas |
| Rendimiento | Chunk principal 3,003 kB (821 kB gzip) | jsPDF, ExcelJS, html2canvas y páginas de resultados en el bundle inicial | Carga diferida de exportaciones y de páginas de resultados; PDF ya no arrastra ExcelJS | build (tamaños en el informe) |

## 02-11d — corrección tras verificar en producción

En producción, `/chat` abierto directo (sin caso) respondía a «¿Cuánto es 12 × 24? Para el caso son 48, pero
todavía no cambies la cantidad» con «Entendido: no cambié nada. Tu caso sigue así: producto «»…», sin el 288.
Causa: las reglas de cálculo + número y de valores contradictorios exigían un producto en el caso, y la línea del
caso imprimía el producto vacío. Corrección: ambas reglas aplican también sin caso; sin producto se muestra
«producto sin indicar». Pruebas: bloque «02-11d» en `tests/cierre-02-11c.test.ts` (3 casos; fallan sobre 02-11c).
Versión `2026.11.02-d`.

## 02-11h — correo solo ASCII (igual que el servidor)

Versión `2026.11.02-h`.

El servidor rechaza con 400 `email_not_supported` los correos con tildes, eñes, homógrafos o caracteres invisibles, porque `toLowerCase()` podía convertirlos en otra dirección real.

`utils/emailFormat.ts` (`emailProblem`) aplica la misma regla en el inicio y en «Hablar con SEAL» (formulario `noValidate`), con el mensaje «Escribe el correo sin tildes, eñes ni caracteres especiales…». Los demás campos `type="email"` ya los rechaza el navegador: Chromium marca inválidos `Ka@…`, `k​a@…`, `josé@…` y `ana@pruéba.test`.

Pruebas: `tests/identidad-02-11h.test.ts`.
