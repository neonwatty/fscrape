'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  quality?: number;
  fill?: boolean;
  sizes?: string;
  className?: string;
  containerClassName?: string;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  aspectRatio?: '16/9' | '4/3' | '1/1' | '3/2' | '2/3';
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  lazy?: boolean;
  threshold?: number;
  fallbackSrc?: string;
  showLoader?: boolean;
}

/**
 * Optimized image component with lazy loading and responsive sizing
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  quality = 75,
  fill = false,
  sizes,
  className,
  containerClassName,
  placeholder = 'empty',
  blurDataURL,
  onLoad,
  onError,
  aspectRatio,
  objectFit = 'cover',
  lazy = true,
  threshold: _threshold = 0.1,
  fallbackSrc = '/images/placeholder.svg',
  showLoader = true,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState(src);

  useEffect(() => {
    setImageSrc(src);
    setError(false);
  }, [src]);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setError(true);
    if (fallbackSrc && imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc);
    }
    onError?.();
  };

  const aspectRatioClass = aspectRatio ? `aspect-[${aspectRatio}]` : '';

  if (fill) {
    return (
      <div className={cn('relative overflow-hidden', containerClassName, aspectRatioClass)}>
        {showLoader && isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <Image
          src={imageSrc}
          alt={alt}
          fill
          sizes={sizes || '100vw'}
          quality={quality}
          priority={priority}
          className={cn(
            'object-cover transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100',
            className
          )}
          style={{ objectFit }}
          placeholder={placeholder}
          blurDataURL={blurDataURL}
          onLoad={handleLoad}
          onError={handleError}
          loading={priority ? 'eager' : lazy ? 'lazy' : undefined}
        />
      </div>
    );
  }

  return (
    <div className={cn('relative inline-block', containerClassName, aspectRatioClass)}>
      {showLoader && isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <Image
        src={imageSrc}
        alt={alt}
        width={width || 500}
        height={height || 500}
        quality={quality}
        priority={priority}
        sizes={sizes}
        className={cn(
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100',
          className
        )}
        style={{ objectFit }}
        placeholder={placeholder}
        blurDataURL={blurDataURL}
        onLoad={handleLoad}
        onError={handleError}
        loading={priority ? 'eager' : lazy ? 'lazy' : undefined}
      />
    </div>
  );
}

/**
 * Avatar image component with optimized loading
 */
export function AvatarImage({
  src,
  alt,
  size = 40,
  className,
  fallbackSrc = '/images/default-avatar.svg',
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
  fallbackSrc?: string;
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn('rounded-full', className)}
      containerClassName="overflow-hidden rounded-full"
      objectFit="cover"
      showLoader={false}
      fallbackSrc={fallbackSrc}
    />
  );
}

/**
 * Thumbnail image component with lazy loading
 */
export function ThumbnailImage({
  src,
  alt,
  width = 200,
  height = 150,
  className,
  containerClassName,
  priority = false,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  containerClassName?: string;
  priority?: boolean;
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn('rounded-lg', className)}
      containerClassName={cn('overflow-hidden rounded-lg', containerClassName)}
      objectFit="cover"
      quality={60}
      priority={priority}
      lazy={!priority}
    />
  );
}

/**
 * Hero image component with responsive sizing
 */
export function HeroImage({
  src,
  alt,
  className,
  containerClassName,
  priority = true,
  aspectRatio = '16/9',
}: {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  priority?: boolean;
  aspectRatio?: '16/9' | '4/3' | '1/1';
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      fill
      className={className}
      containerClassName={cn('w-full', containerClassName)}
      aspectRatio={aspectRatio}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 80vw"
      quality={85}
      priority={priority}
      placeholder="blur"
    />
  );
}

/**
 * Gallery image component with progressive loading
 */
export function GalleryImage({
  src,
  alt,
  index,
  className,
  containerClassName,
  onClick,
}: {
  src: string;
  alt: string;
  index: number;
  className?: string;
  containerClassName?: string;
  onClick?: () => void;
}) {
  const priority = index < 4; // Prioritize first 4 images

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-lg transition-transform hover:scale-105',
        containerClassName
      )}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        className={cn('cursor-pointer', className)}
        aspectRatio="1/1"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        quality={70}
        priority={priority}
        lazy={!priority}
      />
    </button>
  );
}
