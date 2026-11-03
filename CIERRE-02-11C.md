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

## 02-11i — coherencia con la identidad QA exacta del servidor

Versión `2026.11.02-i`. Backend `2026.11.02-i`: la clasificación QA es por identidad exacta, así que un alias `+` no listado sigue el flujo comercial.

Defecto relacionado corregido: si la búsqueda se rechazaba por el correo (`email_not_supported`, por ejemplo un correo con tildes guardado en el navegador antes de 02-11h), la página decía «Revisa la descripción y la cantidad», que no era la causa. Ahora lee el código del 400 y muestra «Tu correo tiene tildes, eñes o caracteres especiales… Vuelve al inicio y escríbelo sin ellos». La búsqueda no se descuenta.

La página no decide quién es QA: lo hace solo el servidor, con su lista. `?qa=1` solo marca la sesión para las métricas.

Pruebas: `tests/qa-identidad-02-11i.test.ts`.

## 02-11j — auditoría integral (frontend)

Versión `2026.11.02-j`. Pruebas de comportamiento en `tests/auditoria-02-11j.test.ts` (14): con el código anterior fallan 10. En el navegador local (con Resend simulado) también pasan `s16` (resultados y costos, ES/EN) y `s17` (móvil de 390 px y accesibilidad básica).

| Sev. | Defecto | Corrección |
|---|---|---|
| Media | Los medios centavos se redondeaban hacia abajo: 5 × US$0.83 se imprimía Q32.78 en vez de Q32.79, y la base del DAI y del IVA («FOB + seguro Q2,059.13») no cuadraba con las filas impresas (Q2,059.14) | `round2`: medio centavo hacia arriba, sin ruido binario. Las bases son la suma de las filas impresas (comprobado en 200 escenarios) |
| Media | En la pantalla, la nota de presupuesto y la de pedido pequeño usaban montos sin redondear: diferían 1 centavo del PDF y el Excel, o mostraban «Q0.0008» | Usan los montos impresos (`linesTotalQ` y `groupQ`) |
| Media | Un tipo de cambio 0, texto o fuera de rango desde el servidor daba «QNaN» o rompía la página de costos | `sanitizeRates` |
| Media | En el teléfono (390 px), el encabezado de resultados se salía 150 px de la pantalla, porque el botón «Hablar con SEAL» llevaba `inline-flex` y `hidden` a la vez | `ContactSeal` respeta `hidden` |
| Media | Rechazos 400: cantidad, presupuesto o PDF inválidos mostraban «Revisa tu correo»; en la cotización, «intenta de nuevo», que vuelve a fallar | `utils/sendErrors.ts` nombra el dato rechazado; con «invalid PDF» se descarga el PDF |
| Media | Medallas oro, plata y bronce en el orden sugerido (se leían como «mejor proveedor») | Número neutro con «no es un aval de SEAL» |
| Baja | Tasas redondeadas a entero («8%» para un cálculo con 7.5%) | `ratePct` |
| Baja | Tarifa LCL sin centavos (Q1,551 × 3.30 no daba la fila); sin explicar el mínimo cobrable ni el cobro por peso | 2 decimales, «(mínimo cobrable)» y «(por peso)» |
| Baja | Excel: «Q0.2400» y «0.0%» para montos diminutos | Formato de centavos y «<0.1%» |
| Baja | El chat decía 15% DAI, 12% IVA y 30–45 días fijos | Usa las tasas vigentes |
| Baja | Textos: país «CN»; visor de imágenes en español con la página en inglés; «Leads Guardados» y un botón «Exportar a CRM» que no hacía nada; «Desglose completo» con el flete pendiente; «te atendemos de inmediato»; «No recomendado»; «Datos en vivo» con datos de caché; «si va a comprar»; historial en español dentro del inglés; enlace del caso sin aviso de que la página está en español | Corregidos |
| Baja | Accesibilidad: botón de enviar del chat, «volver» del formulario y corazón de guardar sin nombre accesible; selector de orden sin etiqueta | `aria-label` y `aria-pressed` |

**Sin cambiar, a propósito:**
- «Para comprar con más seguridad **se requiere** el servicio de verificación…»: es redacción comercial de SEAL; se puede cambiar a «se recomienda» si se decide.
- El valor por unidad redondeado no reconstruye el total en cantidades grandes (es inherente al redondeo).

**Build:**
- El aviso de `eval` viene de ExcelJS (se carga solo al exportar). El sitio no tiene una CSP que lo bloquee.
- Los paquetes grandes son ExcelJS y jsPDF, que se cargan al exportar.
- `npm audit`: las 2 críticas son de `tinypool` (vitest, solo desarrollo), no del sitio.

**Revisión independiente (pasada 5), corregido:**
- `round2` daba NaN con montos menores que 1e-6 (por la notación exponencial). Ahora devuelve 0 bajo medio centavo y deja igual los valores de 1e15 en adelante.
- La línea de flete LCL es exactamente «m³ mostrados × tarifa mostrada» (3.30 × Q1,551.27 = Q5,119.19).
- El mensaje de caso repetido avisa cuando el teléfono o la empresa nuevos no se aplicaron (`contactPending`).

## 02-11k — verificación del correo y token del caso (frontend)

Versión `2026.11.02-k`. Pruebas: `tests/verificacion-02-11k.test.ts`. El detalle del servidor está en `CIERRE-02-11C.md` del backend.

- **Informe por correo.** Ahora va en dos pasos: el correo propio, luego un código de 6 dígitos y, al final, el envío con `reportGrant`. Se eliminaron el destinatario libre, el nombre libre y `seal_report_token`. El modal dice que el PDF se genera en el navegador y es una orientación preliminar. Si la autorización venció o ya se usó, se pide un código nuevo.
- **Búsquedas.** Envían `verifiedSession` si hay una sesión verificada de ese correo. Solo cambia los límites de una cuenta QA.
- **Casos.** Al crearse, el caso guarda «ID:token» de su enlace firmado (máx. 5, `localStorage`) y lo manda en `caseAuth`. Un repetido sin token se muestra como «recibido» sin número, sin enlace y sin conversión, e indica WhatsApp para agregar datos. Se eliminó `contactPending`.
- **Revisión independiente:**
  - Un repetido sin token ya no muestra «Solicitud enviada». Dice que no se creó ni cambió ningún caso y ofrece WhatsApp, sin un número de caso vacío.
  - `/quota` envía la sesión QA en un encabezado, no en la URL.
  - Se borra `seal_report_token`.

## 02-11l — rendimiento y mensajes de verificación (frontend)

Versión `2026.11.03-l`. Pruebas en `tests/rendimiento-02-11l.test.ts` (6; con el código anterior fallan 4). Las otras 2 cuidan que no se reintroduzca lo que ya estaba bien: exportaciones diferidas y ExcelJS sin `eval` con la dependencia nueva.

| Causa raíz | Cambio | Antes → después |
|---|---|---|
| El logo era un PNG de 1536×1024 (2.2 MB) importado en 7 pantallas, incluida la portada, y se mostraba a 85 px de alto como máximo | WebP de 480×320 con calidad 90. Diferencia media por canal frente al original al tamaño mostrado: 0.2–0.35 sobre 255 | 2,201.62 kB → 24.25 kB |
| Chat y formulario iban en el paquete inicial | Rutas diferidas con precarga cuando la portada queda libre | `index` 620.60 kB (gzip 200.97) → 576.31 kB (gzip 187.90) |
| ExcelJS 3.10 traía un polyfill con `eval` | ExcelJS 4.4.0, que ya no lo trae; el aviso de `eval` desapareció del build | `reportExports` 1,081.30 kB (gzip 273.08) → 951.85 kB (gzip 275.03) |

**Mediciones en navegador (portada servida localmente, bytes sin comprimir):**
- **Total al cargar:** 2,968 KB → 843 KB.
- **Imágenes:** 2,226 KB → 100 KB.
- **JS:** el índice baja de 606 a 563 KB, más 42 KB de chat y formulario precargados.

ExcelJS y jsPDF ya se cargaban solo con `import()` al exportar (`lazyExports`), y siguen así.

**Pendiente:**
- `reportExports` (ExcelJS, 952 kB) sigue arriba de 500 kB y el build lo advierte. Solo se descarga al exportar, y no se subió el límite para esconder el aviso.
- El índice sigue en 576 kB. La mayor parte es `utils/chatReply.ts` (340 KB de código fuente), que la portada usa para interpretar la consulta. Bajarlo exige separar ese módulo; queda propuesto.

**Mensajes nuevos (ES/EN):**
- Espera indicada por el servidor («Espera 30 segundos…»), con la aclaración de que los códigos ya recibidos siguen sirviendo.
- Botón «Ya tengo un código».
- Aviso «La verificación de correo no está disponible… no se envió nada».

## 02-11m — código de 8 caracteres y esperas en horas (frontend)

- **Campo del código:** ahora es de 8 caracteres, letras y números (por ejemplo `ABCD-2345`).
  - Teclado de texto, mayúsculas automáticas y sin corrector.
  - Se aceptan espacios, guiones y minúsculas: `confirmVerification` los normaliza.
  - Un código del formato anterior (6 dígitos) da error de formato en la pantalla, sin llamar al servidor.
- **Mensajes ES/EN:**
  - «te llegará un código de 8 caracteres»;
  - «Escribe los 8 caracteres del código (letras y números)»;
  - si la espera indicada por el servidor dura horas, se dice en horas.
- **Pruebas:** `tests/verificacion-02-11k.test.ts` y `tests/rendimiento-02-11l.test.ts` quedaron actualizadas.

## 02-11n — código de 10 caracteres y tope diario explicado (frontend)

- **Código de verificación:** 10 caracteres de letras y números (por ejemplo `ABCDE-23456`). El cálculo de riesgo que lo justifica está en el `CIERRE-02-11C.md` del backend.
  - Teclado de texto, mayúsculas automáticas y sin corrector.
  - Se aceptan espacios, guion y minúsculas.
  - Un código de 8 o de 6 caracteres da error de formato sin llamar al servidor.
- **Tope diario de informes:** cuando el servidor responde 429 `report_limit`, la pantalla dice en ES/EN que ese correo ya recibió el máximo de 3 informes en 24 horas y descarga el PDF.
- **Pruebas:** `tests/verificacion-02-11k.test.ts` y `tests/rendimiento-02-11l.test.ts` quedaron actualizadas.
