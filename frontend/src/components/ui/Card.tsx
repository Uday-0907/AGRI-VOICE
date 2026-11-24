import type { HTMLAttributes, ReactNode } from 'react';

type CardTone = 'default' | 'muted' | 'accent';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tone?: CardTone;
  interactive?: boolean;
  as?: 'div' | 'article' | 'section';
}

export function Card({
  children,
  tone = 'default',
  interactive = false,
  as: Component = 'div',
  className = '',
  ...rest
}: CardProps) {
  const classes = [
    'av-card',
    tone !== 'default' ? `av-card--${tone}` : '',
    interactive ? 'av-card--interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="av-card-header">
      <div>
        <h3 className="av-card-title">{title}</h3>
        {subtitle ? <p className="av-card-subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export default Card;
