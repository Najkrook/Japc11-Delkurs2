import test from 'node:test';
import assert from 'node:assert/strict';
import {
  courseProgress,
  loadExtraStudiesModule,
  renderCourseShell,
  selectCourseSubView,
} from '../src/course/course-view.ts';
import type { CourseHostContext } from '../src/course/types.ts';

function createMockHost(): CourseHostContext & { renderCount: number } {
  const host = {
    theme: 'classic' as const,
    toggleTheme: () => {},
    user: null,
    account: () => {},
    speak: () => 'ok' as const,
    tts: true,
    status: 'Redo',
    renderCount: 0,
    render: () => {
      host.renderCount++;
    },
    announce: () => {},
  };
  return host;
}

test('Ticket 09: loadExtraStudiesModule dynamically resolves extra-studies module', async () => {
  const mod = await loadExtraStudiesModule();
  assert.ok(mod);
  assert.equal(typeof mod.renderExtraStudiesModule, 'function');
});

test('Ticket 09: selectCourseSubView("extra") loads module and renders extra-studies view', async () => {
  const host = createMockHost();

  // Switch to extra view
  selectCourseSubView('extra', host);
  assert.equal(courseProgress.snapshot().activeSubView, 'extra');

  // Wait for dynamic import
  await loadExtraStudiesModule(host);

  // Shell should render full extra-studies view
  const template = renderCourseShell(host);
  assert.ok(template);
  // Verify strings in lit-html template result
  const renderedText = JSON.stringify(template);
  assert.ok(
    renderedText.includes('Extra studier') || renderedText.includes('taekim-arcs'),
    'Template should render Extra studier content',
  );

  // Return to hub
  selectCourseSubView('hub', host);
  assert.equal(courseProgress.snapshot().activeSubView, 'hub');
});
