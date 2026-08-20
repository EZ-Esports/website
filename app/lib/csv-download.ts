/**
 * Triggers a browser download of `content` as a CSV file named `filename`.
 * Uses Blob and an object URL, so it only works in a browser context --
 * call it from a client-side event handler, never during server rendering.
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
