/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  isBlockedSandboxModule,
  normalizeModuleSpecifier,
} from '../sandboxRequirePolicy';

describe('sandboxRequirePolicy', () => {
  it('normalizes node: prefix and subpaths', () => {
    expect(normalizeModuleSpecifier('node:child_process')).toBe(
      'child_process'
    );
    expect(normalizeModuleSpecifier('fs/promises')).toBe('fs');
    expect(normalizeModuleSpecifier('lodash')).toBe('lodash');
  });

  it('blocks high-risk built-ins', () => {
    expect(isBlockedSandboxModule('child_process')).toBe(true);
    expect(isBlockedSandboxModule('node:vm')).toBe(true);
    expect(isBlockedSandboxModule('worker_threads')).toBe(true);
    expect(isBlockedSandboxModule('node:module')).toBe(true);
  });

  it('allows common safe modules and packages', () => {
    expect(isBlockedSandboxModule('fs')).toBe(false);
    expect(isBlockedSandboxModule('path')).toBe(false);
    expect(isBlockedSandboxModule('lodash')).toBe(false);
    expect(isBlockedSandboxModule('./local-file')).toBe(false);
  });
});
