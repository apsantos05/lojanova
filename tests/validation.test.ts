import { describe, expect, it } from 'vitest';
import { hashSession, validCpf, validSession, validTransaction } from '../lib/validation';

describe('validações do checkout', () => {
  it('valida sessão e transação sem aceitar caracteres de caminho', () => {
    expect(validSession('sessao_123456')).toBe(true);
    expect(validSession('../segredo')).toBe(false);
    expect(validTransaction('tx-123_ABC')).toBe(true);
    expect(validTransaction('../tx')).toBe(false);
  });

  it('valida CPF pelos dígitos verificadores', () => {
    expect(validCpf('529.982.247-25')).toBe(true);
    expect(validCpf('111.111.111-11')).toBe(false);
  });

  it('não persiste a sessão em texto puro no banco', () => {
    expect(hashSession('sessao_123456')).toHaveLength(64);
    expect(hashSession('sessao_123456')).not.toContain('sessao');
  });
});
