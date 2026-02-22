import { transpileWithTypeScript } from '../electron/transpiler/swcTranspiler';

const testCases = [
  {
    name: 'While Loop (Standard)',
    code: `while(true) { console.log("loop"); }`,
  },
  {
    name: 'For Loop (Standard)',
    code: `for(let i=0; i<10; i++) { console.log(i); }`,
  },
  {
    name: 'Do-While Loop',
    code: `do { console.log("do"); } while(true);`,
  },
  {
    name: 'For-Of Loop',
    code: `for(const item of [1,2,3]) { console.log(item); }`,
  },
  {
    name: 'For-In Loop',
    code: `for(const key in {a:1}) { console.log(key); }`,
  },
  {
    name: 'Nested Loops',
    code: `
      while(true) {
        for(let i=0; i<10; i++) {
            console.log("nested");
        }
      }
    `,
  },
  {
    name: 'Single Statement Loop (No Braces)',
    code: `while(true) console.log("no braces");`,
  },
  {
    name: 'For Loop Single Statement (No Braces)',
    code: `for(let i=0; i<5; i++) console.log(i);`,
  },
];

let failed = false;

console.log('Starting Comprehensive AST Loop Protection Verification...\n');

testCases.forEach((test, index) => {
  try {
    const transformed = transpileWithTypeScript(test.code, {
      loopProtection: true,
    });

    // Basic check: looks for the injected variables and throw statements
    const hasCounter = /__loop_\d+/.test(transformed);
    const hasCheck = transformed.includes('Loop limit exceeded');
    const hasCancel = transformed.includes('Execution cancelled');

    console.log(`[${index + 1}] ${test.name}:`);
    if (hasCounter && hasCheck && hasCancel) {
      console.log('  ✅ Protection Injected');

      // Additional checks for specific cases
      if (test.name.includes('Nested')) {
        // Should have at least 2 counters for nested loops
        const match = transformed.match(/__loop_\d+/g);
        const uniqueCounters = new Set(match).size;
        if (uniqueCounters >= 2) {
          console.log('  ✅ Unique counters for nested loops verified');
        } else {
          console.error(
            '  ❌ FAILED: Nested loops seem to share counters or missing counters'
          );
          console.log('     Transformed Code:\n', transformed);
          failed = true;
        }
      }

      if (test.name.includes('No Braces')) {
        // Should have braces now
        if (transformed.includes('{') && transformed.includes('}')) {
          console.log('  ✅ Block wrapping verified');
        } else {
          console.error(
            '  ❌ FAILED: Single statement loop not wrapped correctly'
          );
          console.log('     Transformed Code:\n', transformed);
          failed = true;
        }
      }
    } else {
      console.error('  ❌ FAILED: Protection missing');
      console.log('     Transformed Code:\n', transformed);
      failed = true;
    }
  } catch (e) {
    console.error(`  ❌ CRASH: Transformation failed for ${test.name}`, e);
    failed = true;
  }
  console.log('');
});

if (failed) {
  console.error('⚠️  Verification FAILED: Some test cases did not pass.');
  process.exit(1);
} else {
  console.log('🎉 Verification PASSED: All test cases handled correctly.');
  process.exit(0);
}
