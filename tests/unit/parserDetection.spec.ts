import { describe, expect, it } from 'vitest';
import { detectWithParsers } from '../../packages/languages/src/detection/parserDetection';

describe('parserDetection C/C++ support', () => {
  it('detects C code without marking it executable in the active runtime', () => {
    const result = detectWithParsers(
      '#include <stdio.h>\nint main(){ printf("Hello from C\\n"); return 0; }'
    );

    expect(result?.monacoId).toBe('c');
    expect(result?.isExecutable).toBe(false);
  });

  it('detects C++ code without marking it executable in the active runtime', () => {
    const result = detectWithParsers(
      '#include <iostream>\nint main(){ std::cout << "Hello from C++" << std::endl; return 0; }'
    );

    expect(result?.monacoId).toBe('cpp');
    expect(result?.isExecutable).toBe(false);
  });
});
