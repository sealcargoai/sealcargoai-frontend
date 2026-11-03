// What the server's answer to «enviar informe por correo» means for the page (02-11e).
// The server decides who is QA (its QA_EMAILS list); the page only reads the answer.
export type ReportRefusal = "invalid_email" | "qa_routing" | "qa_recipient" | "not_sent_here" | null;

/** null: not a refusal (sent, forwarded, or an unexpected error handled by the caller). */
export function reportRefusal(status: number, error?: unknown): ReportRefusal {
  if (status === 400) return "invalid_email";
  if (status === 503) return "qa_routing";
  // a QA account may only send reports to QA accounts: nothing was sent and no PDF is needed
  if (status === 403 && error === "qa_recipient_not_allowed") return "qa_recipient";
  if (status === 403 || status === 429) return "not_sent_here";
  return null;
}
