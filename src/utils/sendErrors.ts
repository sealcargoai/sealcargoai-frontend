// 02-11j: one reading of the server's 400 answer to «enviar a SEAL» for every form. It used to say
// «Revisa tu correo» for any 400, also when the server refused the quantity, the budget or the format
// of another field (the client then corrected the wrong thing, or retried and failed again).
type L = (es: string, en: string) => string;

/** The message for a refused request to SEAL (status 400), naming the field that was refused. */
export function sealRefusalMessage(error: string | undefined, L: L): string {
  const e = String(error || "");
  if (/^quantity_/.test(e))
    return L("La cantidad de tu caso no es válida (debe ser un número entero de 1 a 10,000,000). Corrígela en el chat o en el formulario y vuelve a enviar.", "Your case quantity is not valid (it must be a whole number from 1 to 10,000,000). Correct it in the chat or the form and send again.");
  if (/^budget_/.test(e))
    return L("El presupuesto de tu caso no es válido (mayor a US$0 y hasta US$100,000,000). Corrígelo y vuelve a enviar.", "Your case budget is not valid (above US$0 and up to US$100,000,000). Correct it and send again.");
  if (e === "invalid_fields")
    return L("Algunos datos del caso no tienen un formato válido. Revisa el formulario y vuelve a enviar.", "Some case data is not in a valid format. Check the form and send again.");
  if (e === "email_not_supported")
    return L("Escribe el correo sin tildes, eñes ni caracteres especiales, por ejemplo nombre@empresa.com.", "Write the email without accents or special characters, for example name@company.com.");
  return L("Revisa tu nombre y correo (por ejemplo nombre@empresa.com).", "Check your name and email (for example name@company.com).");
}

/** The message for a refused report email (status 400): the PDF is not the client's email. */
export function reportRefusal400Message(error: string | undefined, L: L): { message: string; downloadPdf: boolean } {
  if (String(error || "") === "invalid PDF")
    return { message: L("No pudimos adjuntar el PDF al correo, así que no se envió; el informe se descargará en este dispositivo.", "We couldn't attach the PDF to the email, so it wasn't sent; the report will download to this device."), downloadPdf: true };
  if (String(error || "") === "email_not_supported")
    return { message: L("Escribe el correo sin tildes, eñes ni caracteres especiales, por ejemplo nombre@empresa.com.", "Write the email without accents or special characters, for example name@company.com."), downloadPdf: false };
  return { message: L("Revisa el correo: debe ser completo, por ejemplo nombre@empresa.com.", "Check the email: it must be complete, for example name@company.com."), downloadPdf: false };
}
