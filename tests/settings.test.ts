import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma, type Setting } from '@prisma/client';
import { findOrCreateSetting } from '../src/lib/settings-loader';

const row = { id: 1, letingName: 'Pusaka Jeumala' } as Setting;
const conflict = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

test('reads the existing row without creating it', async () => {
  let creates = 0;
  const result = await findOrCreateSetting({ find: async () => row, create: async () => { creates++; return row; } });
  assert.equal(result, row);
  assert.equal(creates, 0);
});

test('creates the row only when it is missing', async () => {
  let creates = 0;
  const result = await findOrCreateSetting({ find: async () => null, create: async () => { creates++; return row; } });
  assert.equal(result, row);
  assert.equal(creates, 1);
});

test('re-reads the row when another request created it first', async () => {
  let reads = 0;
  const result = await findOrCreateSetting({
    find: async () => (++reads === 1 ? null : row),
    create: async () => { throw conflict(); },
  });
  assert.equal(result, row);
  assert.equal(reads, 2);
});

test('rethrows unexpected errors', async () => {
  await assert.rejects(
    findOrCreateSetting({ find: async () => null, create: async () => { throw new Error('boom'); } }),
    /boom/,
  );
});
