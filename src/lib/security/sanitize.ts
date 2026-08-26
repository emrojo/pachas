/**
 * Security & Input Sanitization Utilities for Pachas
 * Defends against XSS, HTML injection, and malicious file payloads.
 */

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB maximum raw upload

/**
 * Escapes HTML characters to prevent XSS injection in user-supplied strings.
 */
export function sanitizeText(input: string | null | undefined, maxLength: number = 500): string {
  if (!input) return '';
  
  // Trim and limit length
  const trimmed = input.trim().slice(0, maxLength);

  // Replace HTML special characters with their safe entity representations
  return trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates and safely scales/compresses an image client-side before upload or base64 storage.
 * Strictly prohibits SVG (which can contain embedded <script> tags) and executable formats.
 */
export function validateAndCompressImage(
  file: File,
  maxDimensionPx: number = 400,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    // 1. Check file size
    if (file.size > MAX_IMAGE_BYTES) {
      return reject(new Error('El archivo excede el tamaño máximo permitido (5 MB).'));
    }

    // 2. Strict MIME type check (Prohibit SVG/HTML/application payloads)
    if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
      return reject(
        new Error('Formato de imagen no permitido. Solo se aceptan archivos JPG, PNG o WebP.')
      );
    }

    // 3. Prevent filename manipulation or path traversal
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (cleanFileName.toLowerCase().endsWith('.svg') || cleanFileName.toLowerCase().endsWith('.html')) {
      return reject(new Error('Formato de archivo no válido por motivos de seguridad.'));
    }

    // 4. Safe image decoding & canvas compression
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen.'));
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result !== 'string') {
        return reject(new Error('Error al procesar los datos de la imagen.'));
      }

      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen válida o está dañado.'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimensionPx) {
              height = Math.round((height * maxDimensionPx) / width);
              width = maxDimensionPx;
            }
          } else {
            if (height > maxDimensionPx) {
              width = Math.round((width * maxDimensionPx) / height);
              height = maxDimensionPx;
            }
          }

          canvas.width = Math.max(width, 1);
          canvas.height = Math.max(height, 1);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('No se pudo inicializar el procesador de imágenes.'));
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (err) {
          reject(new Error('Error durante el procesamiento seguro de la imagen.'));
        }
      };

      img.src = result;
    };

    reader.readAsDataURL(file);
  });
}
