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

/** Reads a user-picked file as text. */
export function readFileAsText(file: File): Promise<string> {
  return file.text();
}
