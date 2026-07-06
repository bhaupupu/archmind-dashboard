import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './encryption';

describe('encryption', () => {
  it('round-trips a plaintext string', () => {
    const plaintext = 'ghp_someRealisticLookingGitHubToken1234567890';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces a different ciphertext (and IV) for the same plaintext each time', () => {
    const a = encrypt('same-input');
    const b = encrypt('same-input');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same-input');
    expect(decrypt(b)).toBe('same-input');
  });

  it('rejects a tampered ciphertext (auth tag mismatch)', () => {
    const ciphertext = encrypt('sensitive-value');
    const [iv, authTag, body] = ciphertext.split(':');
    const tampered = `${iv}:${authTag}:${body.slice(0, -2)}ff`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it('rejects a malformed ciphertext format', () => {
    expect(() => decrypt('not-the-right-format')).toThrow('Invalid encrypted text format.');
  });
});
