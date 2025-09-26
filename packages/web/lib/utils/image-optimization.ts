/**
 * Image optimization utilities for Next.js applications
 */

interface ImageDimensions {
  width: number;
  height: number;
}

interface OptimizedSizes {
  thumbnail: ImageDimensions;
  small: ImageDimensions;
  medium: ImageDimensions;
  large: ImageDimensions;
  full: ImageDimensions;
}

/**
 * Standard image sizes for optimization
 */
export const IMAGE_SIZES: OptimizedSizes = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 320, height: 240 },
  medium: { width: 640, height: 480 },
  large: { width: 1024, height: 768 },
  full: { width: 1920, height: 1080 },
};

/**
 * Device size breakpoints for responsive images
 */
export const DEVICE_SIZES = {
  mobile: 640,
  tablet: 768,
  laptop: 1024,
  desktop: 1280,
  wide: 1536,
} as const;

/**
 * Generate srcSet string for responsive images
 */
export function generateSrcSet(
  baseSrc: string,
  sizes: number[] = [640, 750, 828, 1080, 1200, 1920, 2048, 3840]
): string {
  return sizes.map((size) => `${baseSrc}?w=${size} ${size}w`).join(', ');
}

/**
 * Generate sizes attribute for responsive images
 */
export function generateSizes(
  config: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
    default?: string;
  } = {}
): string {
  const {
    mobile = '100vw',
    tablet = '50vw',
    desktop = '33vw',
    default: defaultSize = '100vw',
  } = config;

  return `(max-width: ${DEVICE_SIZES.mobile}px) ${mobile}, (max-width: ${DEVICE_SIZES.tablet}px) ${tablet}, (max-width: ${DEVICE_SIZES.desktop}px) ${desktop}, ${defaultSize}`;
}

/**
 * Calculate optimal dimensions maintaining aspect ratio
 */
export function calculateOptimalDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): ImageDimensions {
  const aspectRatio = originalWidth / originalHeight;

  let width = originalWidth;
  let height = originalHeight;

  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Get image quality based on size
 */
export function getOptimalQuality(width: number): number {
  if (width <= IMAGE_SIZES.thumbnail.width) return 60;
  if (width <= IMAGE_SIZES.small.width) return 70;
  if (width <= IMAGE_SIZES.medium.width) return 75;
  if (width <= IMAGE_SIZES.large.width) return 80;
  return 85;
}

/**
 * Generate blur data URL placeholder
 */
export async function generateBlurDataURL(_imageSrc: string): Promise<string> {
  // In a real implementation, this would generate a low-quality base64 image
  // For now, return a simple gradient placeholder
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIj48c3RvcCBzdG9wLWNvbG9yPSIjMzMzIiBvZmZzZXQ9IjIwJSIgLz48c3RvcCBzdG9wLWNvbG9yPSIjMjIyIiBvZmZzZXQ9IjUwJSIgLz48c3RvcCBzdG9wLWNvbG9yPSIjMzMzIiBvZmZzZXQ9IjcwJSIgLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiMzMzMiIC8+PHJlY3QgaWQ9InIiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0idXJsKCNnKSIgLz48L3N2Zz4=';
}

/**
 * Preload critical images
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Preload multiple images
 */
export async function preloadImages(srcs: string[]): Promise<void[]> {
  return Promise.all(srcs.map(preloadImage));
}

/**
 * Check if image is in viewport
 */
export function isImageInViewport(element: HTMLElement, threshold = 0): boolean {
  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;

  const vertInView = rect.top <= windowHeight + threshold && rect.bottom >= -threshold;
  const horInView = rect.left <= windowWidth + threshold && rect.right >= -threshold;

  return vertInView && horInView;
}

/**
 * Lazy load images using Intersection Observer
 */
export class ImageLazyLoader {
  private observer: IntersectionObserver | null = null;
  private images: Map<Element, string> = new Map();

  constructor(
    private options: IntersectionObserverInit = {
      rootMargin: '50px',
      threshold: 0.01,
    }
  ) {
    this.initObserver();
  }

  private initObserver(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.loadImage(entry.target);
        }
      });
    }, this.options);
  }

  private loadImage(element: Element): void {
    const src = this.images.get(element);
    if (!src) return;

    if (element instanceof HTMLImageElement) {
      element.src = src;
      element.onload = () => {
        element.classList.add('loaded');
      };
    }

    this.observer?.unobserve(element);
    this.images.delete(element);
  }

  observe(element: Element, src: string): void {
    if (!this.observer) {
      // Fallback for browsers without IntersectionObserver
      if (element instanceof HTMLImageElement) {
        element.src = src;
      }
      return;
    }

    this.images.set(element, src);
    this.observer.observe(element);
  }

  disconnect(): void {
    this.observer?.disconnect();
    this.images.clear();
  }
}

/**
 * Image format detection
 */
export function getOptimalImageFormat(): 'webp' | 'avif' | 'jpeg' {
  if (typeof window === 'undefined') return 'jpeg';

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  // Check AVIF support
  if (canvas.toDataURL('image/avif').indexOf('image/avif') === 5) {
    return 'avif';
  }

  // Check WebP support
  if (canvas.toDataURL('image/webp').indexOf('image/webp') === 5) {
    return 'webp';
  }

  return 'jpeg';
}

/**
 * Progressive image loading strategy
 */
export class ProgressiveImageLoader {
  private loadedImages = new Set<string>();

  async loadImage(
    src: string,
    placeholder?: string,
    onProgress?: (loaded: boolean) => void
  ): Promise<void> {
    if (this.loadedImages.has(src)) {
      onProgress?.(true);
      return;
    }

    // Load placeholder first if provided
    if (placeholder) {
      await preloadImage(placeholder);
      onProgress?.(false);
    }

    // Load full image
    await preloadImage(src);
    this.loadedImages.add(src);
    onProgress?.(true);
  }

  clearCache(): void {
    this.loadedImages.clear();
  }
}

/**
 * Image optimization configuration
 */
export interface ImageOptimizationConfig {
  formats: Array<'webp' | 'avif' | 'jpeg' | 'png'>;
  quality: number;
  sizes: number[];
  deviceSizes: number[];
  minimumCacheTTL: number;
  dangerouslyAllowSVG: boolean;
}

export const defaultImageConfig: ImageOptimizationConfig = {
  formats: ['webp', 'avif'],
  quality: 75,
  sizes: [16, 32, 48, 64, 96, 128, 256, 384],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  minimumCacheTTL: 60 * 60 * 24, // 24 hours
  dangerouslyAllowSVG: false,
};

/**
 * Get responsive image props
 */
export function getResponsiveImageProps(
  src: string,
  alt: string,
  config?: Partial<ImageOptimizationConfig>
) {
  const finalConfig = { ...defaultImageConfig, ...config };

  return {
    src,
    alt,
    sizes: generateSizes(),
    quality: finalConfig.quality,
    placeholder: 'blur' as const,
    loading: 'lazy' as const,
  };
}
