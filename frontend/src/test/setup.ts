import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

beforeAll(() => {
  window.scrollTo = () => {};
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.location.hash = '';
});
