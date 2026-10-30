# Cierre 29-b · SmartTrade AI (frontend)

Rama `fix/cierre-29-b` sobre `candidata-28-o` (`cf8768c` = PR #1 29-a fusionado). Versión visible: `v2026.10.30-a · <commit>` (pie de página; incluye la regresión de producción del 30).
Backend: rama `fix/cierre-29-b` sobre `main` (`3a656f1`), versión `2026.10.29-b` en `/health`.

> El paquete del 29 (`INFORME-SEAL-29.md`, parches `frontend-PR1-hardening.patch` y `backend-hardening.patch`) **no estaba disponible** en esta sesión.
> Las correcciones se implementaron sobre el código publicado, por intención, con pruebas propias. Si el paquete aparece, sus pruebas independientes deben ejecutarse sobre este commit.

## Recorrido de toda modificación del caso

Intención (`nextSpec`) → campos propuestos → **autorización** (prohibiciones por campo; «pídeme confirmación» = propuesta pendiente; dudas, condiciones, preguntas, discurso referido, tiempos pasados/futuros = se consulta)
→ **comprensión completa** (`fullyUnderstood`: la cláusula que trae el valor debe coincidir con una forma conocida; lo demás se consulta)
→ validación (tipo, rango, notación, token completo; también en `writeCaseTx` y en el servidor)
→ aplicación en **una transacción** (borrador + caso para SEAL + puntero de producto; si algo falla, se restaura todo)
→ lectura de comprobación → la respuesta sale del **estado guardado**.

## Causas raíz corregidas

| Defecto | Causa raíz | Corrección (mecanismo general) |
|---|---|---|
| 1 «pídeme confirmación antes» aplicaba | No existía la noción de confirmación previa; solo `HOLD` («no cambies nada») | `CONFIRM_FIRST` + propuesta pendiente en almacén separado (`seal_pending`), ligada a caso y versión, aplicada solo con confirmación simple y solo si la respuesta anterior la ofreció |
| 2 «Do not update the quantity to 8» aplicaba | Las negaciones solo se leían como «mantén lo demás» | `prohibitions()`: verbo negado → campo prohibido (o todos); prohibiciones por característica (`specForbidden`) |
| 3 «5e2» parcial | `normalizeNumbers` convierte `1e3`; `\b(\d+)` leía partes | `notationIssue()` antes de normalizar; `valueTokenIssue()`: el valor debe estar escrito completo (sin rangos, cotas, fracciones, otros números pegados) |
| 4 «¿Y si cambio de producto: …?» cambiaba | La declaración de producto no pasaba por la compuerta de hipótesis | Hipótesis/condición bloquean toda mutación, incluido el producto; `cleanProductName()` |
| 5 JSON dañado impedía abrir el chat | `JSON.parse` sin protección en render | `parseSpec` / `cleanMessages`: historial validado; lo dañado se descarta |
| 6 Escritura parcial anunciada como éxito | Dos `setItem` independientes; la verificación leía solo el borrador | `commit()` transaccional con restauración y lectura de comprobación; `caseId` + `rev` en borrador y caso; `repairCase()` |
| 7 Servidor aceptaba objetos/arrays/presupuestos malformados | `clean()` convertía objetos en "" en silencio; formatos laxos | `malformedFields()`, `quantityError`/`budgetError` estrictos; validación **antes** de registrar, notificar o reservar cuota |
| (revisión) Formulario antiguo sobrescribía | El formulario escribía el borrador entero sin versión | `saveFormDraft(…, lastRev)`: compare-and-set; si el caso avanzó, el formulario recarga |
| (revisión) StrictMode | Efecto de cambio de producto dentro del inicializador de `useState` | Cálculo puro en el inicializador; escritura idempotente en `useEffect` |
| (revisión, 9 rondas adversariales) | Lectura por listas de frases | Regla general: **solo se aplica lo entendido por completo**; lo demás se consulta sin crear propuesta |

## Regresión de producción 2026-10-30 (reportada sobre v2026.10.28-n)

| Caso | Causa | Corrección | Pruebas |
|---|---|---|---|
| Con 4 compresores, «3.5 compresores… no cambies nada» → 4 → 5 | 28-n leía la cola del decimal y no respetaba «no cambies nada» | Ya corregido en 29-a/29-b (token completo, `HOLD`) | L `R36`; N `B81` |
| «serían 10,000,001 compresores» aceptado y en el resumen | 28-n no validaba el máximo en esa ruta | Ya corregido (rango en todas las rutas, `writeCaseTx`, servidor) | L `R36`; N `B82`, `B83` |
| Presupuesto US$5,000 del pedido inicial perdido | La página de inicio guardaba la frase entera como «producto»: la cantidad y el presupuesto nunca entraban al caso. Además, un presupuesto dicho junto con un producto nuevo en el chat se descartaba | `requestFacts()`: el pedido inicial se separa en producto, cantidad y presupuesto con las mismas reglas del chat (solo valores exactos y válidos; lo dudoso se informa y no se guarda). En el chat, el presupuesto dicho con el producto nuevo se conserva | L `R36`; N `B80`, `B83`, `B84` |
| (encontrado en la prueba de navegador) El formulario rechazaba descripciones normales | `fieldError` aplicaba `plainNumber` (que quita espacios) a la descripción | La descripción se valida como texto | L `R37`; N `B83` |

## Entorno de prueba que impide envíos reales

- Builds de **preview de Vercel** (`VERCEL_ENV=preview`) y locales con `APP_SANDBOX=1` son *sandbox* (`src/utils/sandbox.ts`): `/api/email/*`, `/api/events`, búsqueda y toda escritura se responden en el navegador; GTM no se incluye en el HTML. Banner «ENTORNO DE PRUEBA».
- Producción (`VERCEL_ENV=production`) no cambia: GTM presente, sin sandbox.
- Backend: `EMAIL_DRY_RUN=1` impide técnicamente enviar correos (cliente Resend sustituido); `/health` informa `emailDryRun`.

## Matriz trazable (requisito → prueba)

Entornos: **L** = local unitario/integración con mocks (vitest, `sessionStorage` en memoria, `fetch` simulado); **C** = componente React en jsdom con `StrictMode`; **N** = navegador real Chromium sobre build sandbox local (`e2e/run-e2e.mjs`); **S** = servidor real local con Resend simulado (`node --test`).

| Requisito | Pruebas |
|---|---|
| Cantidades 1 y 10,000,000 | L `R01` |
| Rechazo 0, -1, 3.5, 10,000,001 (chat, formulario, `writeCaseTx`) | L `R02`; S `cierre-29-b`, `case-validation` |
| Vacíos, ambiguos, rangos, notación, ES/EN | L `R03`, `R27`, `R29`, `R30`; S `quantityError/budgetError` |
| Cantidad 3→4 · presupuesto → US$5,000 · tanque 500→300 L | L `R04/R05/R06`, `AUDIT-F`; N `B17` |
| Correcciones consecutivas y rechazadas | L `R07`, `R13` |
| Prohibiciones, hipótesis, confirmación previa/posterior, confirmación obsoleta | L `R08`, `R24`, `R27`–`R35`; C `D1`; N `B12–B16` |
| Los dos mensajes originales exactos | L `R09`; N `B10`, `B11` |
| Matemática → corrección del caso | L `R10`; N `B11` |
| Cambio hipotético y real de producto | L `R11`, `R30`, `R33`; N `B16` |
| Dos conversaciones independientes | L `R12`; N `B60`, `B61` |
| Mensajes rápidos, respuestas fuera de orden, compare-and-set | L `R13`; C rápidos/doble clic/Enter repetido; N `B50`, `B51` |
| Duplicados y errores de red | L `R14`; C doble clic |
| React StrictMode | C `R15` |
| Historial y borradores dañados | L `R16`; C `D5`; N `B40` |
| Fallos parciales y totales de almacenamiento | L `R17`; N `B30`, `B31` |
| Chat → formulario → chat, recarga, caso nuevo, pantalla antigua | L `R18/R19/R25`; C recarga; N `B18–B20`, `B60` |
| Resumen visible = payload | L `R20` (todas las superficies en cada prueba); N `B21` |
| Servidor valida antes de registro, notificación y cuota | S `cierre-29-b` (12 malformados en `/quote`, 7 en `/search` con cuota intacta) |
| ES/EN coherentes; sin promesas | L `R22/R23`; N `B70` |
| Ningún envío real | L sandbox; S `EMAIL_DRY_RUN`; N `B03`, `B22`, `B90` |

## 30-b · regresiones reportadas sobre v2026.10.30-a

| Problema reportado | Causa raíz | Corrección | Pruebas |
|---|---|---|---|
| Consulta de cantidad respondida con un cálculo anterior de lápices | El seguimiento de cálculos (`followUpMath`) tomaba cualquier número suelto como continuación del último cálculo, aunque hubiera un caso abierto | Un número suelto después de un cálculo, con caso abierto y sin referencia explícita a los artículos del cálculo, se **pregunta** (`askContext`); nada cambia. «¿Y para 600 lápices?» sigue usando el cálculo | L `R38.6`, `AUDIT-X` (actualizada: «¿Y si fueran 600?» ahora pregunta; el equivalente explícito «600 lápices» da 25 cajas); N `B87` |
| «Corrijo: son 6 compresores» después de un cálculo convertía la frase en producto y borraba cantidad y presupuesto | `nounOut` suprimía «N compresores» tras el cálculo; la frase quedaba como producto nuevo porque «corrijo» se tomaba como sustantivo principal | `namesCaseProduct` (el sustantivo del caso tiene prioridad) y `cleanProductName` rechaza correcciones, verbos y «son/serían + número» | L `R38.2`, `R38.6`; N `B86` |
| «No enviar caso comercial» terminaba en la descripción y el presupuesto no se reconocía | `requestFacts` no separaba notas de control y su captura del monto tomaba «5,000. No» como número | `stripControl()` separa notas de control (oraciones, paréntesis, guiones, comas y la frase dentro de la oración) antes de leer el pedido o un mensaje; captura estricta del monto; el saludo dice que la nota se tomó como nota; un mensaje solo de control no cambia nada | L `R38.5`; N `B85`, `B88` |
| 3.5 con «no cambies nada» y 10,000,001 con «actualiza únicamente la cantidad» | (ya rechazados en 30-a; ahora con regresión permanente exacta) | — | L `R38.1`, `R38.8`; N `B81`, `B82`, `B86` |

Matriz permanente `R38.1`–`R38.8`: mensajes exactos, límites 1 / 10,000,000 y 0 / negativos / fracciones / >máximo, cambios encadenados en ambos órdenes, hipotético↔cambio, negaciones y notas de control (chat y pedido inicial), navegación chat↔formulario, recarga, borradores con versión vieja y resumen, ES/EN sin mezcla.

## Comandos

```
npm ci
bash e2e/verify.sh ../sealcargoai-backend    # una ronda completa; repetir sin editar para la segunda
```

## Limitaciones conocidas

- El chat es determinista (expresiones regulares). La regla «solo lo entendido por completo» hace que frases no previstas se **consulten** en vez de aplicarse; el costo es que algunas peticiones legítimas piden aclaración (p. ej. «Corrijo: no son 4 sino 7 compresores», «Cambiala a 7» con producto con medidas).
- Las pruebas de navegador usan el sandbox: la integración real frontend→backend de preview no se ejercita en navegador (el backend se prueba como servidor real local con Resend simulado).
- No se modificó la fórmula del flete.
