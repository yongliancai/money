import test from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';
import { inspectSource } from '../../scripts/guardrails.mjs';

test('architecture positive and negative fixtures really execute checker', () => {
  assert.deepEqual(
    inspectSource(
      'client/src/test.js',
      "import { x } from '../../shared/schemas/index.js';",
    ),
    [],
  );
  for (const code of [
    "import '../../server/src/index.js';",
    "export * from '../../server/src/index.js';",
    "await import('../../server/src/index.js');",
    "const x = require('../../server/src/index.js');",
  ])
    assert.ok(inspectSource('client/src/test.js', code).length > 0);
  assert.ok(
    inspectSource('shared/x.js', "import '../client/src/main.js'").length > 0,
  );
});
test('secret scanner rejects synthetic secret and private-key header; clean environment template passes', () => {
  assert.ok(
    inspectSource('x.txt', 'sk' + '-proj-' + 'A'.repeat(32)).length > 0,
  );
  assert.ok(
    inspectSource('x.txt', '-----BEGIN ' + 'PRIVATE KEY-----').length > 0,
  );
  assert.deepEqual(
    inspectSource('x.txt', 'VAPID_PRIVATE_KEY=\nAI_MODE=disabled'),
    [],
  );
});
test('ESLint real restricted import negative fails; shared import positive passes', async () => {
  const eslint = new ESLint();
  const bad = await eslint.lintText("import '../../server/src/index.js';", {
    filePath: 'client/src/negative.js',
  });
  assert.ok(bad[0].messages.some((m) => m.ruleId === 'no-restricted-imports'));
  const good = await eslint.lintText(
    "import '../../shared/schemas/index.js';",
    { filePath: 'client/src/positive.js' },
  );
  assert.equal(good[0].errorCount, 0);
});
