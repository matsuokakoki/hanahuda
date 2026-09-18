import { describe, expect, it } from 'vitest';
import { errorMessage } from './model';
describe('web model', () => { it('normalizes Firebase errors', () => expect(errorMessage(new Error('FirebaseError: Functions: old version'))).toContain('old version')); });
