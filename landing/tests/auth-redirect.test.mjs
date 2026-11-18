import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const code = readFileSync(new URL('../dist/auth-redirect.js', import.meta.url), 'utf8');
function destination(href, standalone = false) {
  let result;
  runInNewContext(code, { URL, URLSearchParams, window: { location: { href, replace: value => { result = value; } }, matchMedia: () => ({ matches: standalone }), navigator: {} } });
  return result;
}
test('ordinary landing visits and product anchors remain on the landing', () => {
  assert.equal(destination('https://reforma.noxumlab.com/'), undefined);
  assert.equal(destination('https://reforma.noxumlab.com/#producto'), undefined);
});
test('old confirmation links preserve auth fragments at the new app', () => {
  assert.equal(destination('https://reforma.noxumlab.com/#access_token=demo&refresh_token=demo&type=signup'), 'https://app-reforma.noxumlab.com/#access_token=demo&refresh_token=demo&type=signup');
});
test('old invitation and code callbacks preserve query parameters', () => {
  assert.equal(destination('https://reforma.noxumlab.com/?invite=demo'), 'https://app-reforma.noxumlab.com/?invite=demo');
  assert.equal(destination('https://reforma.noxumlab.com/?code=demo'), 'https://app-reforma.noxumlab.com/?code=demo');
});
test('installed app startup forwards to the new application', () => {
  assert.equal(destination('https://reforma.noxumlab.com/', true), 'https://app-reforma.noxumlab.com/');
});
