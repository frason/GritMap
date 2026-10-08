export interface ImportTotals {
  imported: number;
  replaced: number;
  duplicate: number;
  failed: number;
}

export interface ImportSummary {
  tone: "success" | "warning" | "error";
  text: string;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Live progress while files are being imported ("Importing file 2 of 5…"). */
export function describeImportProgress(done: number, total: number): string {
  return `Importing file ${Math.min(done + 1, total)} of ${total}…`;
}

/**
 * What happened once every chosen file has been handled, in the rider's words. The tone is the
 * worst thing that happened: any failure is a warning (or an error when nothing at all got in),
 * so a rider scanning the screen cannot mistake a partly failed import for a clean one.
 */
export function describeImportSummary(totals: ImportTotals): ImportSummary {
  const total = totals.imported + totals.replaced + totals.duplicate + totals.failed;
  const parts: string[] = [];
  if (totals.imported > 0) parts.push(`${totals.imported} added`);
  if (totals.replaced > 0) parts.push(`${totals.replaced} replaced`);
  if (totals.duplicate > 0) parts.push(`${totals.duplicate} already in GritMap`);
  if (totals.failed > 0) parts.push(`${totals.failed} couldn't be read`);
  const detail = parts.join(", ");

  if (totals.failed === total) {
    return {
      tone: "error",
      text: `${total === 1 ? "That file" : `None of those ${total} files`} couldn't be imported. GritMap reads FIT and GPX ride files; check the file came from a bike computer or a ride app.`,
    };
  }
  if (totals.failed > 0) {
    return { tone: "warning", text: `${plural(total, "file")} handled: ${detail}.` };
  }
  const added = totals.imported + totals.replaced;
  if (added === 0) {
    return { tone: "success", text: `Nothing new to add: ${detail}.` };
  }
  return { tone: "success", text: `Done: ${detail}. GritMap has checked ${added === 1 ? "it" : "them"} against your segments.` };
}
