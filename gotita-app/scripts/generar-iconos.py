"""Genera el icono de Gotita: una gota minimalista dibujada por vector, no a
partir de un emoji ni de una imagen de origen.

Por que vector y no redimensionar un PNG: un trazo fino se ve bien a 512px y
desaparece o se ve dentado a 48px si se hace resize. Aqui cada tamano se
dibuja de cero con su propio grosor de trazo proporcional, y se renderiza a
4x y se reduce con LANCZOS para que el contorno salga suave.

Geometria de la gota: envolvente convexa de un circulo y un punto (el apice)
por encima de el. El contorno visible son las dos tangentes desde el apice
al circulo, mas el arco lejano del circulo (el arco cercano al apice queda
"dentro" de la envolvente y no se dibuja). El trazo hueco (silueta, sin
relleno) sale de restar una gota exterior menos una interior mas pequena
como mascaras, no de dibujar una polilinea gruesa: una polilinea deja
costuras de aliasing donde cada segmento se solapa con el siguiente.
"""
import math
import os

from PIL import Image, ImageDraw, ImageChops

RAIZ = os.path.join(os.path.dirname(__file__), "..")


def _puntos_gota(radio, altura_apice, segmentos_arco=200):
    R, H = radio, altura_apice
    delta = math.acos(min(1.0, R / H))
    ang_der = math.pi / 2 - delta
    ang_izq = math.pi / 2 + delta
    T_der = (R * math.cos(ang_der), R * math.sin(ang_der))
    T_izq = (R * math.cos(ang_izq), R * math.sin(ang_izq))
    apice = (0, H)
    arco = []
    ang_fin = ang_izq - 2 * math.pi
    for i in range(segmentos_arco + 1):
        t = ang_der + (ang_fin - ang_der) * i / segmentos_arco
        arco.append((R * math.cos(t), R * math.sin(t)))
    return [apice, T_der] + arco + [T_izq]


def _mascara_gota(lado, R, H, cx, cy):
    """Mascara en escala de grises (255 = dentro) de una gota SOLIDA."""
    m = Image.new("L", (lado, lado), 0)
    pts = [(cx + x, cy - y) for x, y in _puntos_gota(R, H)]
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


def gota_png(
    lado_px,
    factor_relleno=0.58,
    grosor_frac=0.055,
    color=(0, 0, 0, 255),
    fondo=None,
    supersample=4,
):
    """
    lado_px: tamano final del PNG cuadrado.
    factor_relleno: cuanta altura del icono ocupa la gota (0-1). 0.58 es
        "mediano": deja aire alrededor, no toca los bordes del icono.
    grosor_frac: grosor del trazo como fraccion de lado_px.
    fondo: color RGBA de fondo, o None para transparente.
    """
    S = lado_px * supersample
    altura_total = S * factor_relleno
    R = altura_total / 2.7  # H/R ~1.7 da forma de gota; ni bola ni cono
    H = R * 1.7
    cx, cy = S / 2, S / 2 + altura_total * 0.06  # centrado optico, no geometrico

    grosor = max(2, round(S * grosor_frac))
    exterior = _mascara_gota(S, R, H, cx, cy)
    interior = _mascara_gota(S, R - grosor, H - grosor, cx, cy)
    anillo = ImageChops.subtract(exterior, interior)

    lienzo = Image.new("RGBA", (S, S), fondo or (0, 0, 0, 0))
    trazo = Image.new("RGBA", (S, S), color)
    lienzo.paste(trazo, (0, 0), anillo)

    return lienzo.resize((lado_px, lado_px), Image.LANCZOS)


if __name__ == "__main__":
    BLANCO = (255, 255, 255, 255)

    # PWA: transparentes, tal cual se pidio. El maskable transparente es una
    # excepcion a la practica recomendada (la spec sugiere rellenar toda la
    # zona segura para que no varie entre lanzadores de Android que pintan el
    # hueco de blanco, negro o un color propio); se hace igualmente porque es
    # lo que se pidio explicitamente.
    iconos = os.path.join(RAIZ, "public", "iconos")
    os.makedirs(iconos, exist_ok=True)
    for lado in (192, 512):
        gota_png(lado).save(f"{iconos}/icono-{lado}.png")
        gota_png(lado).save(f"{iconos}/maskable-{lado}.png")

    # apple-touch-icon: iOS no respeta el canal alfa, pinta el hueco de
    # negro. Con fondo transparente el trazo negro quedaria invisible sobre
    # ese negro, asi que este va sobre blanco.
    gota_png(180, fondo=BLANCO).save(f"{iconos}/apple-touch-icon.png")

    # Bundle nativo (Expo/EAS). No se genera ningun build nativo desde este
    # repo ahora mismo (no hay /ios ni /android commiteados), pero se
    # mantienen coherentes por si el dia de manana se hace un build.
    imagenes = os.path.join(RAIZ, "assets", "images")
    gota_png(1024).save(f"{imagenes}/icon.png")
    gota_png(48).save(f"{imagenes}/favicon.png")
    gota_png(512).save(f"{imagenes}/android-icon-foreground.png")
    # La capa "monochrome" de Android solo usa el canal alfa; el sistema la
    # tine con el color de acento del usuario, el color aqui es indiferente.
    gota_png(432).save(f"{imagenes}/android-icon-monochrome.png")

    print("ok")
