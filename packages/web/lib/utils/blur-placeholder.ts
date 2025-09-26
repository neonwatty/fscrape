/**
 * Blur placeholder generation utilities
 */

/**
 * Generate a shimmer SVG placeholder
 */
export function shimmer(w: number, h: number): string {
  return `
    <svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <linearGradient id="g">
          <stop stop-color="#333" offset="20%" />
          <stop stop-color="#222" offset="50%" />
          <stop stop-color="#333" offset="70%" />
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="#333" />
      <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
      <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite"  />
    </svg>`;
}

/**
 * Convert shimmer to base64 data URL
 */
export function toBase64(str: string): string {
  return typeof window === 'undefined' ? Buffer.from(str).toString('base64') : window.btoa(str);
}

/**
 * Generate blur data URL
 */
export function generateBlurPlaceholder(width = 40, height = 40): string {
  return `data:image/svg+xml;base64,${toBase64(shimmer(width, height))}`;
}

/**
 * Create gradient placeholder
 */
export function createGradientPlaceholder(colors: string[] = ['#f0f0f0', '#e0e0e0']): string {
  const svg = `
    <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          ${colors
            .map(
              (color, i) =>
                `<stop offset="${(i * 100) / (colors.length - 1)}%" style="stop-color:${color}" />`
            )
            .join('')}
        </linearGradient>
      </defs>
      <rect width="40" height="40" fill="url(#gradient)" />
    </svg>
  `;
  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

/**
 * Create solid color placeholder
 */
export function createSolidPlaceholder(color = '#f0f0f0'): string {
  const svg = `
    <svg width="1" height="1" xmlns="http://www.w3.org/2000/svg">
      <rect width="1" height="1" fill="${color}" />
    </svg>
  `;
  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

/**
 * Generate placeholder based on dominant color
 */
export async function generateDominantColorPlaceholder(imageSrc: string): Promise<string> {
  if (typeof window === 'undefined') {
    return createSolidPlaceholder();
  }

  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(createSolidPlaceholder());
        return;
      }

      canvas.width = 1;
      canvas.height = 1;

      ctx.drawImage(img, 0, 0, 1, 1);

      try {
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        const color = `rgb(${r}, ${g}, ${b})`;
        resolve(createSolidPlaceholder(color));
      } catch {
        resolve(createSolidPlaceholder());
      }
    };

    img.onerror = () => {
      resolve(createSolidPlaceholder());
    };

    img.src = imageSrc;
  });
}

/**
 * Placeholder cache for performance
 */
class PlaceholderCache {
  private cache = new Map<string, string>();
  private maxSize = 100;

  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: string): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const placeholderCache = new PlaceholderCache();

/**
 * Get or generate blur placeholder with caching
 */
export async function getBlurPlaceholder(
  src: string,
  type: 'shimmer' | 'gradient' | 'solid' | 'dominant' = 'shimmer'
): Promise<string> {
  const cacheKey = `${src}-${type}`;
  const cached = placeholderCache.get(cacheKey);

  if (cached) return cached;

  let placeholder: string;

  switch (type) {
    case 'gradient':
      placeholder = createGradientPlaceholder();
      break;
    case 'solid':
      placeholder = createSolidPlaceholder();
      break;
    case 'dominant':
      placeholder = await generateDominantColorPlaceholder(src);
      break;
    case 'shimmer':
    default:
      placeholder = generateBlurPlaceholder();
      break;
  }

  placeholderCache.set(cacheKey, placeholder);
  return placeholder;
}
