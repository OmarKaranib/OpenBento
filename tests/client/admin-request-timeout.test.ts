import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('every admin stream-cleanup check has a deadline', () => {
  const source = readFileSync('client/src/pages/admin.tsx', 'utf8');
  const purge = source.slice(
    source.indexOf('const handlePurgeBrokenStreams'),
    source.indexOf('const handleRefreshAll'),
  );

  assert.equal(purge.match(/signal: requestTimeoutSignal\(\)/g)?.length, 3);
  assert.match(purge, /encodeURIComponent\(channel\.channelHandle\)/);
});
