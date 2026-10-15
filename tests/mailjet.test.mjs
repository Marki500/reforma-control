import test from 'node:test'
import assert from 'node:assert/strict'
import { renderProjectComment, renderProjectInvitation } from '../server/mailjet.js'

test('project invitation email includes the project and safe invitation URL', () => {
  const message = renderProjectInvitation({
    projectName: 'Casa del Maresme',
    inviterEmail: 'marc@noxumlab.com',
    inviteUrl: 'https://nivel.example/invite/123',
  })
  assert.match(message.subject, /Casa del Maresme/)
  assert.match(message.text, /https:\/\/nivel\.example\/invite\/123/)
  assert.match(message.html, /Casa del Maresme/)
  assert.match(message.html, /Ver la invitación/)
})

test('project comment email distinguishes mentions and escapes the comment', () => {
  const message = renderProjectComment({
    projectName: 'Casa centro', authorEmail: 'marc@example.com',
    comment: '<b>Revisar</b>\n@ana@example.com', appUrl: 'https://nivel.example', mentioned: true,
  })
  assert.match(message.subject, /mencionado/)
  assert.match(message.html, /&lt;b&gt;Revisar&lt;\/b&gt;<br>/)
  assert.doesNotMatch(message.html, /<b>Revisar<\/b>/)
  assert.match(message.html, /https:\/\/nivel\.example\/settings/)
})

test('project invitation email escapes user-controlled content', () => {
  const message = renderProjectInvitation({
    projectName: '<img src=x onerror=alert(1)>',
    inviterEmail: 'owner<script>@example.com',
    inviteUrl: 'https://nivel.example/invite/123?x="bad"',
  })
  assert.doesNotMatch(message.html, /<img src=x/)
  assert.doesNotMatch(message.html, /owner<script>/)
  assert.match(message.html, /&lt;img/)
  assert.match(message.html, /&quot;bad&quot;/)
})
