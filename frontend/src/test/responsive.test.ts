import { describe, expect, it } from 'vitest';
import globalCss from '../styles/global.css?raw';

describe('Responsive CSS & RTL Layout Coverage', () => {
  it('defines breakpoints for tablet (1024px), mobile (768px), and small phones (420px)', () => {
    expect(globalCss).toContain('@media (max-width: 1024px)');
    expect(globalCss).toContain('@media (max-width: 768px)');
    expect(globalCss).toContain('@media (max-width: 420px)');
  });

  it('uses logical inline properties and explicit RTL rules', () => {
    expect(globalCss).toContain('[dir="rtl"]');
    expect(globalCss).toContain('margin-inline');
    expect(globalCss).toContain('inset-inline-end');
  });
});
