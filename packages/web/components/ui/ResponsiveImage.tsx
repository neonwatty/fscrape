'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { generateSizes } from '@/lib/utils/image-optimization';
import { getBlurPlaceholder } from '@/lib/utils/blur-placeholder';

interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  sizes?: string;
  priority?: boolean;
  quality?: number | ((width: number) => number);
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrc?: string;
  placeholderType?: 'shimmer' | 'gradient' | 'solid' | 'dominant';
  progressive?: boolean;
}

/**
 * Responsive image component with automatic size optimization
 */
export function ResponsiveImage({
  src,
  alt,
  className,
  containerClassName,
  sizes,
  priority = false,
  quality,
  onLoad,
  onError,
  fallbackSrc = '/images/placeholder.svg',
  placeholderType = 'shimmer',
  progressive: _progressive = true,
}: ResponsiveImageProps) {
  const [imageSrc, setImageSrc] = useState(src);
  const [blurDataURL, setBlurDataURL] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate blur placeholder
    getBlurPlaceholder(src, placeholderType).then(setBlurDataURL);
  }, [src, placeholderType]);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    if (fallbackSrc && imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc);
    }
    onError?.();
  };

  const responsiveSizes =
    sizes ||
    generateSizes({
      mobile: '100vw',
      tablet: '50vw',
      desktop: '33vw',
    });

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', containerClassName)}>
      <Image
        src={imageSrc}
        alt={alt}
        fill
        sizes={responsiveSizes}
        quality={typeof quality === 'function' ? 75 : quality}
        priority={priority}
        className={cn(
          'object-cover transition-opacity duration-500',
          isLoading ? 'opacity-0' : 'opacity-100',
          className
        )}
        placeholder={blurDataURL ? 'blur' : 'empty'}
        blurDataURL={blurDataURL}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}

/**
 * Picture element with art direction
 */
export function ResponsivePicture({
  sources,
  alt,
  className,
  containerClassName,
}: {
  sources: Array<{
    srcSet: string;
    media: string;
    type?: string;
  }>;
  alt: string;
  className?: string;
  containerClassName?: string;
}) {
  return (
    <div className={cn('relative', containerClassName)}>
      <picture>
        {sources.map((source, index) => (
          <source key={index} srcSet={source.srcSet} media={source.media} type={source.type} />
        ))}
        <img
          src={sources[sources.length - 1].srcSet}
          alt={alt}
          className={cn('w-full h-auto', className)}
        />
      </picture>
    </div>
  );
}

/**
 * Adaptive image grid component
 */
export function ImageGrid({
  images,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 4,
  className,
}: {
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
  }>;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: number;
  className?: string;
}) {
  const gridCols: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div
      className={cn(
        'grid',
        `gap-${gap}`,
        gridCols[columns.mobile || 1],
        `md:${gridCols[columns.tablet || 2]}`,
        `lg:${gridCols[columns.desktop || 3]}`,
        className
      )}
    >
      {images.map((image, index) => (
        <figure key={index} className="relative">
          <ResponsiveImage
            src={image.src}
            alt={image.alt}
            containerClassName="aspect-square"
            priority={index < 4}
          />
          {image.caption && (
            <figcaption className="mt-2 text-sm text-muted-foreground">{image.caption}</figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

/**
 * Background image with lazy loading
 */
export function BackgroundImage({
  src,
  alt,
  children,
  className,
  overlay = true,
  overlayOpacity = 0.5,
  priority = false,
}: {
  src: string;
  alt: string;
  children?: React.ReactNode;
  className?: string;
  overlay?: boolean;
  overlayOpacity?: number;
  priority?: boolean;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        className={cn(
          'object-cover transition-opacity duration-700',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={() => setIsLoaded(true)}
      />
      {overlay && <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity }} />}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * Carousel image component
 */
export function CarouselImage({
  src,
  alt,
  isActive,
  className,
}: {
  src: string;
  alt: string;
  isActive: boolean;
  className?: string;
}) {
  return (
    <ResponsiveImage
      src={src}
      alt={alt}
      className={cn(
        'transition-transform duration-500',
        isActive ? 'scale-100' : 'scale-95',
        className
      )}
      priority={isActive}
      sizes="(max-width: 640px) 100vw, 80vw"
    />
  );
}

/**
 * Image with zoom on hover
 */
export function ZoomableImage({
  src,
  alt,
  className,
  containerClassName,
  zoomScale: _zoomScale = 1.1,
}: {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  zoomScale?: number;
}) {
  return (
    <div className={cn('group relative overflow-hidden', containerClassName)}>
      <ResponsiveImage
        src={src}
        alt={alt}
        className={cn('transition-transform duration-300 group-hover:scale-110', className)}
        containerClassName="w-full h-full"
      />
    </div>
  );
}

/**
 * Hook for responsive image loading
 */
export function useResponsiveImage(
  src: string,
  options?: {
    threshold?: number;
    rootMargin?: string;
  }
) {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: options?.threshold || 0.1,
        rootMargin: options?.rootMargin || '50px',
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [options?.threshold, options?.rootMargin]);

  return {
    elementRef,
    isInView,
    isLoaded,
    setIsLoaded,
  };
}
