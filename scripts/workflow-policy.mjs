import { parse } from 'yaml';
import { readFileSync, readdirSync } from 'node:fs';

export function inspectCI(workflow) {
  const errors = [];
  const permissions = [
    workflow.permissions,
    ...Object.values(workflow.jobs || {}).map((job) => job.permissions),
  ];
  if (
    permissions.some(
      (p) =>
        p === 'write-all' ||
        p?.pages === 'write' ||
        p?.['id-token'] === 'write',
    )
  )
    errors.push('Active CI must not have deployment permissions');
  for (const job of Object.values(workflow.jobs || {}))
    for (const step of job.steps || []) {
      if (
        /actions\/(?:deploy-pages|configure-pages)@/.test(step.uses || '') ||
        /\b(?:deploy|publish)\b|gh pr merge/i.test(step.run || '')
      )
        errors.push('Active CI must not publish or merge');
    }
  return errors;
}
export function inspectReleaseTemplate(workflow) {
  const errors = [];
  if (
    JSON.stringify(Object.keys(workflow.on || {})) !==
    JSON.stringify(['workflow_dispatch'])
  )
    errors.push('Release must be manual only');
  if (
    !workflow.jobs?.build?.if?.includes(
      "inputs.confirmation == 'PUBLISH money'",
    ) ||
    !workflow.jobs?.build?.if?.includes('refs/heads/main')
  )
    errors.push('Release needs explicit confirmation and main branch gate');
  const deploy = workflow.jobs?.deploy;
  if (
    deploy?.needs !== 'build' ||
    deploy?.environment?.name !== 'github-pages' ||
    deploy?.permissions?.pages !== 'write' ||
    deploy?.permissions?.['id-token'] !== 'write'
  )
    errors.push(
      'Release needs verified build, protected environment and scoped permissions',
    );
  return errors;
}
export function checkWorkflowFiles() {
  const errors = [];
  for (const file of readdirSync('.github/workflows'))
    if (/\.ya?ml$/.test(file)) {
      const workflow = parse(readFileSync(`.github/workflows/${file}`, 'utf8'));
      const inspect =
        file === 'pages-release.yml' ? inspectReleaseTemplate : inspectCI;
      errors.push(...inspect(workflow).map((error) => `${file}: ${error}`));
    }
  const template = readFileSync(
    '.github/workflow-templates/pages-release.yml.disabled',
    'utf8',
  );
  errors.push(...inspectReleaseTemplate(parse(template)));
  return errors;
}
