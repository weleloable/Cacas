import {
  esIOS,
  esSafariIOS,
  estaInstalada,
  queOfrecer,
  AYUDA_IOS_SAFARI,
  AYUDA_IOS_OTRO_NAVEGADOR,
} from '@/lib/instalacion';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_MODERNO =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Mobile Safari/537.36';
const MAC = IPAD_MODERNO;
const CHROME_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/127.0.6533.72 Mobile/15E148 Safari/604.1';
const FIREFOX_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15';

describe('esIOS', () => {
  it('reconoce iPhone', () => {
    expect(esIOS(IPHONE)).toBe(true);
  });

  it('reconoce el iPad moderno, que se hace pasar por Mac', () => {
    // Desde iPadOS 13 el user agent es idéntico al de un Mac. Lo único que los
    // separa es que el iPad reporta puntos táctiles.
    expect(esIOS(IPAD_MODERNO, 5)).toBe(true);
  });

  it('no confunde un Mac de verdad con un iPad', () => {
    expect(esIOS(MAC, 0)).toBe(false);
  });

  it('no da iOS en Android', () => {
    expect(esIOS(ANDROID, 5)).toBe(false);
  });
});

describe('estaInstalada', () => {
  it('la detecta por display-mode standalone', () => {
    expect(estaInstalada(true)).toBe(true);
  });

  it('y por navigator.standalone, que es lo que usa iOS', () => {
    expect(estaInstalada(false, true)).toBe(true);
  });

  it('en una pestaña normal dice que no', () => {
    expect(estaInstalada(false, false)).toBe(false);
    expect(estaInstalada(false, undefined)).toBe(false);
  });
});

describe('queOfrecer', () => {
  it('nada si ya está instalada, aunque haya evento', () => {
    expect(queOfrecer({ instalada: true, tieneEvento: true, ios: false })).toBe('nada');
    expect(queOfrecer({ instalada: true, tieneEvento: false, ios: true })).toBe('nada');
  });

  it('botón cuando Chrome nos ha dado el evento', () => {
    expect(queOfrecer({ instalada: false, tieneEvento: true, ios: false })).toBe('boton');
  });

  it('ayuda en iOS, que no tiene diálogo nativo', () => {
    expect(queOfrecer({ instalada: false, tieneEvento: false, ios: true })).toBe('ayudaIOS');
  });

  it('nada en un navegador de escritorio que no lo soporta', () => {
    expect(queOfrecer({ instalada: false, tieneEvento: false, ios: false })).toBe('nada');
  });
});

describe('AYUDA_IOS_SAFARI', () => {
  it('nombra los dos pasos reales de Safari', () => {
    expect(AYUDA_IOS_SAFARI).toContain('Compartir');
    expect(AYUDA_IOS_SAFARI).toContain('Añadir a pantalla de inicio');
  });
});

describe('AYUDA_IOS_OTRO_NAVEGADOR', () => {
  it('avisa de que hay que cambiar a Safari', () => {
    expect(AYUDA_IOS_OTRO_NAVEGADOR).toContain('Safari');
  });
});

describe('esSafariIOS', () => {
  // "Añadir a pantalla de inicio" sólo existe en el menú de compartir de
  // Safari. Chrome y Firefox en iOS son Safari por dentro (Apple obliga a
  // WebKit) pero no tienen ese menú, así que hay que distinguirlos.
  it('Safari de verdad da true', () => {
    expect(esSafariIOS(IPHONE)).toBe(true);
  });

  it('Chrome en iOS (CriOS) da false', () => {
    expect(esSafariIOS(CHROME_IOS)).toBe(false);
  });

  it('Firefox en iOS (FxiOS) da false', () => {
    expect(esSafariIOS(FIREFOX_IOS)).toBe(false);
  });
});
