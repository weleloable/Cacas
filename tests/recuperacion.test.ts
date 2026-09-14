/**
 * Tests de lib/recuperacion.ts: sólo la parte pura (`calcularUrlRestablecer`,
 * `parsearHashRecuperacion`). `urlRestablecerContrasena` es el envoltorio que
 * toca `window`/`Platform`/`Linking` — ese es el borde de I/O, no hace falta
 * volver a probar la lógica que ya cubren estos dos.
 */
import { calcularUrlRestablecer, parsearHashRecuperacion } from '@/lib/recuperacion';

describe('calcularUrlRestablecer', () => {
  it('en producción, quita "/login" del final y añade la ruta nueva bajo el baseUrl', () => {
    expect(
      calcularUrlRestablecer('https://weleloable.github.io', '/Gotita/login')
    ).toBe('https://weleloable.github.io/Gotita/restablecer-contrasena');
  });

  it('en local (sin baseUrl), funciona igual sin adivinar si hay prefijo', () => {
    expect(calcularUrlRestablecer('http://192.168.1.5:8082', '/login')).toBe(
      'http://192.168.1.5:8082/restablecer-contrasena'
    );
  });

  it('tolera una barra final en el pathname', () => {
    expect(calcularUrlRestablecer('https://weleloable.github.io', '/Gotita/login/')).toBe(
      'https://weleloable.github.io/Gotita/restablecer-contrasena'
    );
  });
});

describe('parsearHashRecuperacion', () => {
  it('extrae access_token y refresh_token de un hash de recuperación válido', () => {
    const hash = '#access_token=abc123&refresh_token=xyz789&expires_in=3600&token_type=bearer&type=recovery';
    expect(parsearHashRecuperacion(hash)).toEqual({
      accessToken: 'abc123',
      refreshToken: 'xyz789',
    });
  });

  it('funciona igual sin la almohadilla inicial', () => {
    const hash = 'access_token=abc123&refresh_token=xyz789&type=recovery';
    expect(parsearHashRecuperacion(hash)).toEqual({
      accessToken: 'abc123',
      refreshToken: 'xyz789',
    });
  });

  it('hash vacío: null, no revienta', () => {
    expect(parsearHashRecuperacion('')).toBeNull();
    expect(parsearHashRecuperacion('#')).toBeNull();
  });

  it('type distinto de "recovery" (p.ej. un magic link de otro flujo): null', () => {
    const hash = '#access_token=abc&refresh_token=xyz&type=signup';
    expect(parsearHashRecuperacion(hash)).toBeNull();
  });

  it('faltando access_token o refresh_token: null, no a medias', () => {
    expect(parsearHashRecuperacion('#refresh_token=xyz&type=recovery')).toBeNull();
    expect(parsearHashRecuperacion('#access_token=abc&type=recovery')).toBeNull();
  });

  it('un hash que no tiene nada que ver (p.ej. un anchor cualquiera): null', () => {
    expect(parsearHashRecuperacion('#seccion-2')).toBeNull();
  });
});
