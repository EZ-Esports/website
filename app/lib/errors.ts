export * from './result';

export class ActionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ActionError';
  }
}

