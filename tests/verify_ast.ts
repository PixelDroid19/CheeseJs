import { transpileWithTypeScript } from '../electron/transpiler/swcTranspiler';

const code = `
while(true) {
  console.log("Infinito");
}
`;

console.log('--- Original Code ---');
console.log(code);

try {
  const transformed = transpileWithTypeScript(code, { loopProtection: true });
  console.log('\n--- Transformed Code ---');
  console.log(transformed);

  if (
    transformed.includes('__loop_0') &&
    transformed.includes('Loop limit exceeded')
  ) {
    console.log('\n[PASS] Loop protection injected successfully.');
  } else {
    console.error('\n[FAIL] Loop protection NOT found.');
    process.exit(1);
  }
} catch (e) {
  console.error('Error:', e);
  process.exit(1);
}
