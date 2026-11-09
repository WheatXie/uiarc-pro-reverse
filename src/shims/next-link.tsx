/** `next/link` stand-in: hands the href to react-router's Link. */
import { forwardRef } from "react";
import { Link } from "react-router-dom";
import type { AnchorHTMLAttributes, ReactNode } from "react";

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children?: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
}

const NextLink = forwardRef<HTMLAnchorElement, LinkProps>(function NextLink({ href, children, prefetch, replace, scroll, shallow, passHref, legacyBehavior, ...rest }, ref) {
  return (
    <Link {...rest} to={href} replace={replace} ref={ref}>
      {children}
    </Link>
  );
});

export default NextLink;
