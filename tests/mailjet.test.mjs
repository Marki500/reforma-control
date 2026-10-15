import test from 'node:test'
import assert from 'node:assert/strict'
import { renderProjectInvitation } from '../server/mailjet.js'

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
