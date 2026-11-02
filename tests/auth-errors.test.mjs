import test from 'node:test'
import assert from 'node:assert/strict'
import { authErrorMessage } from '../src/utils/authErrors.js'

test('translates authentication errors by code rather than server wording', () => {
  assert.match(authErrorMessage({ code: 'invalid_credentials', message: 'Internal detail' }), /no son correctos/)
  assert.match(authErrorMessage({ code: 'captcha_failed' }), /verificación/)
  assert.match(authErrorMessage({ code: 'otp_expired' }), /caducado/)
  assert.match(authErrorMessage({ code: 'email_not_confirmed' }), /Confirma/)
})

test('handles rate limits and connectivity without exposing server details', () => {
  assert.match(authErrorMessage({ status: 429 }), /Demasiados intentos/)
  assert.match(authErrorMessage(new TypeError('Failed to fetch')), /conexión/)
  assert.match(authErrorMessage({ status: 503, message: 'private server detail' }), /servicio/)
  assert.doesNotMatch(authErrorMessage({ message: 'private server detail' }), /private server detail/)
  assert.equal(typeof authErrorMessage(null), 'string')
})

test('keeps local validation messages intact', () => {
  const message = 'Las contraseñas no coinciden.'
  assert.equal(authErrorMessage(new Error(message)), message)
})
