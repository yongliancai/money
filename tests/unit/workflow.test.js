import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { readFileSync } from 'node:fs';
import {
  inspectCI,
  inspectReleaseTemplate,
  checkWorkflowFiles,
} from '../../scripts/workflow-policy.mjs';
test('read-only PR CI passes and active deployment actions or permissions are rejected', () => {
  assert.deepEqual(
    inspectCI({
      permissions: { contents: 'read' },
      jobs: { test: { steps: [{ run: 'npm run verify' }] } },
    }),
    [],
  );
  assert.ok(inspectCI({ permissions: { pages: 'write' } }).length);
  assert.ok(
    inspectCI({
      jobs: { deploy: { steps: [{ uses: 'actions/deploy-pages@v4' }] } },
    }).length,
  );
});
test('release workflows require manual confirmation, main and a successful build', () => {
  const template = parse(
    readFileSync(
      '.github/workflow-templates/pages-release.yml.disabled',
      'utf8',
    ),
  );
  assert.deepEqual(inspectReleaseTemplate(template), []);
  assert.ok(inspectReleaseTemplate({ ...template, on: { push: {} } }).length);
  assert.ok(
    inspectReleaseTemplate({
      ...template,
      jobs: { ...template.jobs, build: { ...template.jobs.build, if: 'true' } },
    }).length,
  );
  assert.deepEqual(checkWorkflowFiles(), []);
});
