import { describe, it, expect } from 'vitest';
import { generateSalt, hashPassword, verifyPassword } from './passwordHash';

describe('passwordHash', () => {
  it('generates a unique salt each time', () => {
    expect(generateSalt()).not.toBe(generateSalt());
  });

  it('hashes the same password+salt deterministically', async () => {
    const salt = generateSalt();
    const first = await hashPassword('hunter2', salt);
    const second = await hashPassword('hunter2', salt);
    expect(first).toBe(second);
  });

  it('produces different hashes for different salts', async () => {
    const a = await hashPassword('hunter2', generateSalt());
    const b = await hashPassword('hunter2', generateSalt());
    expect(a).not.toBe(b);
  });

  it('verifies a correct password', async () => {
    const salt = generateSalt();
    const hash = await hashPassword('correct horse battery staple', salt);
    await expect(verifyPassword('correct horse battery staple', salt, hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const salt = generateSalt();
    const hash = await hashPassword('correct horse battery staple', salt);
    await expect(verifyPassword('wrong password', salt, hash)).resolves.toBe(false);
  });
});
