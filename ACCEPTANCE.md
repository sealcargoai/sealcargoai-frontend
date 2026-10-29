# Matriz de aceptación del caso (SmartTrade AI)

Comando: `npm run test:acceptance` (archivo `tests/acceptance-matrix.test.ts`).
Suite completa: `npm test`. Build: `npm run build`.
Tipos: `npx -y -p typescript@5 tsc --noEmit --strict --jsx react-jsx --module esnext --target es2022 --moduleResolution bundler --skipLibCheck --allowImportingTsExtensions --resolveJsonModule src/main.tsx` (solo se aceptan avisos TS7016/TS2307 de tipos de librerías e imágenes).

## Qué se comprueba

Cada caso revisa el ESTADO, no la redacción de la respuesta. Un caso pasa solo si coinciden:

1. el caso guardado (`currentCase()` en `src/utils/caseStore.ts`);
2. lo que abre el formulario (`formStart()`);
3. el resumen de «Hablar con SEAL» (`caseForSeal()`);
4. el cuerpo exacto que se enviaría a SEAL (`sendToSeal` con `fetch` simulado: no se envía nada);
5. los valores que afirma la respuesta del chat (`producto «…»; cantidad N; presupuesto de compra US$X`).

| Bloque | Cubre |
| --- | --- |
| A | Cambio de una dimensión, de la cantidad, del presupuesto; cambios encadenados; cambio de producto con historial marcado como no vigente |
| B | Cantidad frente a litros, V, Hz, presupuesto, cajas y contenido por caja; separadores y decimales; ambigüedad: pregunta y no cambia nada |
| C | Cálculos (500 lápices en cajas de 12 = 42 cajas, 504, 4 sobrantes; múltiplos; presupuesto) y consultas hipotéticas que no cambian el caso |
| D | Chat → formulario → atrás → chat → formulario con recargas; caso nuevo sin herencia; error y reintento; estimación anterior no enviada como vigente |
| E | Respuesta = estado guardado; sin promesas de autenticidad, garantía, clasificación final o tiempos; SEAL primero; inglés |
| F | Validación de formulario: vacío, cero, negativos, fracciones, máximos, texto corto |
| G | Lo que recibe SEAL coincide con el caso vigente |

No modifique los valores esperados para que una corrida pase.
