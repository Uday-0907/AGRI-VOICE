import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface SharedProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
}

export type ButtonProps = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
    loading?: boolean;
  };

export type ButtonLinkProps = SharedProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    loading?: never;
  };

export function Button(props: ButtonProps | ButtonLinkProps) {
  const {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    children,
  } = props;

  const classes = [
    'av-btn',
    `av-btn--${variant}`,
    `av-btn--${size}`,
    fullWidth ? 'av-btn--full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if ('href' in props && props.href !== undefined) {
    const {
      variant: _v,
      size: _s,
      fullWidth: _fw,
      className: _cn,
      children: _c,
      href,
      ...anchorProps
    } = props;

    return (
      <a href={href} className={classes} {...anchorProps}>
        {children}
      </a>
    );
  }

  const {
    variant: _v,
    size: _s,
    fullWidth: _fw,
    className: _cn,
    children: _c,
    loading = false,
    disabled,
    type = 'button',
    ...buttonProps
  } = props;

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

export default Button;
