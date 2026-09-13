/**
 * Browser-side file -> base64 (no `Buffer`, which isn't available client-side
 * in this Vite bundle). `readAsDataURL` gives `data:<type>;base64,<payload>`
 * — only the payload after the comma is sent to the server.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const commaIndex = result.indexOf(',')
      resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the selected file'))
    reader.readAsDataURL(file)
  })
}
