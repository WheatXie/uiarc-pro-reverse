import type { SVGProps } from "react";

/**
 * Company marks are mono glyphs drawn in `currentColor`, so they follow the toast text colour in
 * both themes. Each one keeps the reference viewBox and path data and is rendered at 18px by the
 * visual slot's CSS.
 */
type MarkProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "fill" | "focusable">;

const base = {
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
  focusable: false,
} as const;

export function LinearMark(props: MarkProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  );
}

export function VercelMark(props: MarkProps) {
  return (
    <svg {...base} {...props}>
      <path d="m12 1.608 12 20.784H0Z" transform="translate(12 13) scale(.86) translate(-12 -12)" />
    </svg>
  );
}

export function SupabaseMark(props: MarkProps) {
  return (
    <svg {...base} {...props}>
      <path d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z" />
    </svg>
  );
}

export function RaycastMark(props: MarkProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.004 15.492v2.504L0 11.992l1.258-1.249Zm2.504 2.504H6.004L12.008 24l1.253-1.253zm14.24-4.747L24 11.997 12.003 0 10.75 1.251 15.491 6h-2.865L9.317 2.692 8.065 3.944l2.06 2.06H8.691v9.31H18v-1.432l2.06 2.06 1.252-1.252-3.312-3.32V8.506ZM6.63 5.372 5.38 6.625l1.342 1.343 1.251-1.253Zm10.655 10.655-1.247 1.251 1.342 1.343 1.253-1.251zM3.944 8.059 2.692 9.31l3.312 3.314v-2.506zm9.936 9.937h-2.504l3.314 3.312 1.25-1.252z" />
    </svg>
  );
}

export function ResendMark(props: MarkProps) {
  return (
    <svg {...base} {...props}>
      <path
        d="M14.679 0c4.648 0 7.413 2.765 7.413 6.434s-2.765 6.434-7.413 6.434H12.33L24 24h-8.245l-8.88-8.44c-.636-.588-.93-1.273-.93-1.86 0-.831.587-1.565 1.713-1.883l4.574-1.224c1.737-.465 2.936-1.81 2.936-3.572 0-2.153-1.761-3.4-3.939-3.4H0V0z"
        transform="translate(12 12) scale(.88) translate(-12 -12)"
      />
    </svg>
  );
}
