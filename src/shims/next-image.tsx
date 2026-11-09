/**
 * `next/image` stand-in for the clone: keeps the same call signature the vendored Arc
 * components use, but resolves to a plain <img> (the site is a client-side SPA).
 */
import { forwardRef } from "react";
import type { CSSProperties, ImgHTMLAttributes, SyntheticEvent } from "react";

export interface StaticImageData {
  src: string;
  height: number;
  width: number;
  blurDataURL?: string;
}

export interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> {
  src: string | StaticImageData;
  alt: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  loader?: unknown;
  unoptimized?: boolean;
  sizes?: string;
  onLoadingComplete?: (image: HTMLImageElement) => void;
}

const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(props, ref) {
  const { src, alt, width, height, fill, priority, quality, placeholder, blurDataURL, loader, unoptimized, sizes, style, onLoadingComplete, ...rest } = props;
  const url = typeof src === "string" ? src : src.src;
  const source = typeof src === "string" ? undefined : { width: src.width, height: src.height };

  const merged: CSSProperties = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }
    : { width, height, ...style };

  return (
    <img
      {...rest}
      ref={ref}
      src={url}
      alt={alt}
      width={fill ? source?.width : width}
      height={fill ? source?.height : height}
      sizes={sizes}
      style={merged}
      data-priority={priority ? "" : undefined}
      onLoad={(event: SyntheticEvent<HTMLImageElement>) => {
        rest.onLoad?.(event);
        onLoadingComplete?.(event.currentTarget);
      }}
    />
  );
});

export default Image;
export type { ImageProps as ImageLoaderProps };
