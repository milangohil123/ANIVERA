/**
 * Type declarations for Vitest and testing utilities.
 * Ensures TypeScript compilation succeeds both before and after npm install.
 */

declare module 'vitest' {
  export function describe(name: string, fn: () => void | Promise<void>): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export const expect: (actual: any) => any;
  export const vi: any;
}

declare module 'vitest/config' {
  export function defineConfig(config: any): any;
}

declare module '@testing-library/jest-dom' {
  // ambient module augmentation for jest-dom matchers
}

declare module 'fake-indexeddb/auto' {
  // auto installs fake indexedDB into global scope
}


