"""Genera los iconos PWA a partir del icono de la app.

Chrome exige 192 y 512 para considerar la web instalable. El maskable es el
que evita que Android recorte el dibujo dentro de su máscara circular: se
dibuja el icono al 80% sobre el fondo de la app, dejando la zona segura.
"""
import os

from PIL import Image

ORIGEN = "assets/images/icon.png"
FONDO = (11, 16, 32, 255)  # tema.fondo #0B1020
SALIDA = "public/iconos"

os.makedirs(SALIDA, exist_ok=True)

base = Image.open(ORIGEN).convert("RGBA")

for lado in (192, 512):
    base.resize((lado, lado), Image.LANCZOS).save(f"{SALIDA}/icono-{lado}.png")

# apple-touch-icon: iOS no respeta transparencia, la pinta en negro.
apple = Image.new("RGBA", (180, 180), FONDO)
apple.alpha_composite(base.resize((180, 180), Image.LANCZOS))
apple.convert("RGB").save(f"{SALIDA}/apple-touch-icon.png")

# Maskable: zona segura del 80%, el resto es fondo que Android puede recortar.
for lado in (192, 512):
    lienzo = Image.new("RGBA", (lado, lado), FONDO)
    interior = int(lado * 0.8)
    margen = (lado - interior) // 2
    lienzo.alpha_composite(base.resize((interior, interior), Image.LANCZOS), (margen, margen))
    lienzo.save(f"{SALIDA}/maskable-{lado}.png")

print("ok")
