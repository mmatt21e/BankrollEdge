// File export/import — the PWA equivalent of the Android share sheet and
// system file picker. Download works everywhere; the Web Share API is used
// when the platform supports sharing files (Android Chrome, iOS Safari 15+).

export async function exportFile(
  filename: string,
  contents: string,
  mimeType: string,
): Promise<void> {
  const blob = new Blob([contents], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      // User cancelled or share failed — fall through to download.
      if ((e as DOMException).name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Reads a user-picked file as text, throwing a human-readable reason when it
 *  can't (empty file, unreadable cloud/placeholder file, access denied…). */
export async function readFileAsText(file: File): Promise<string> {
  if (file.size === 0) {
    throw new Error('the file is empty (0 bytes)');
  }
  try {
    return await file.text();
  } catch (e) {
    const err = e as DOMException;
    if (err?.name === 'NotReadableError') {
      throw new Error(
        'the browser could not read the file — if it lives in cloud storage (iCloud, Drive), download it to the device first, then try again',
      );
    }
    if (err?.name === 'NotFoundError') {
      throw new Error('the file could no longer be found (it may have moved or been deleted)');
    }
    if (err?.name === 'SecurityError') {
      throw new Error('access to the file was blocked by the browser');
    }
    throw new Error(err?.message ? `${err.name}: ${err.message}` : 'an unknown read error occurred');
  }
}

/** Human-readable byte size for error messages: "1.2 MB", "840 bytes". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns a reason string if text doesn't look like a usable CSV, else null.
 *  Catches the common "wrong file" cases (Excel/Numbers workbook, PDF, other
 *  binary) that read successfully but aren't comma-separated text. */
export function describeCsvProblem(text: string, fileName: string): string | null {
  if (text.trim() === '') return 'the file has no text content';
  const head = text.slice(0, 4000);
  // XLSX/Numbers/zip archives start with the ZIP magic "PK".
  if (head.startsWith('PK') || /\.(xlsx|xlsm|numbers|zip)$/i.test(fileName)) {
    return 'this looks like an Excel or Numbers workbook, not a CSV — open it and use “Save As / Export → CSV”, then import that file';
  }
  if (head.startsWith('%PDF')) return 'this is a PDF, not a CSV';
  if (/\.xls$/i.test(fileName)) {
    return 'this is an old Excel (.xls) file — re-save it as CSV first';
  }
  // Stray NUL bytes indicate a binary file (e.g. UTF-16 without BOM, or media).
  if (head.includes('\u0000')) {
    return 'this looks like a binary file rather than plain-text CSV — export it as CSV (UTF-8) and try again';
  }
  return null;
}
