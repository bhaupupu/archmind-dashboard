// Sample TypeScript file for the ingestion spike fixture.
// Contains PLANTED FAKE SECRETS to prove secret-scan-before-embed works.
// These are not real credentials.

import { createHmac } from 'node:crypto';

const AWS_KEY = 'AKIAIOSFODNN7EXAMPLE';          // planted: aws-access-key-id
const apiKey = 'sk-supersecretvalue123456';       // planted: generic-assigned-secret

export interface Session {
  userId: string;
  token: string;
  expiresAt: number;
}

export function signToken(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(userId).digest('hex');
}

export class AuthService {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  createSession(userId: string): Session {
    const token = signToken(userId, this.secret);
    return { userId, token, expiresAt: Date.now() + 3600_000 };
  }

  verify(session: Session): boolean {
    return session.expiresAt > Date.now();
  }
}

export const defaultAuth = new AuthService(apiKey + AWS_KEY);
