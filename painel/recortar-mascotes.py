"""Recorta os mascotes do King Gelo (img/cliente/mascote-*.webp) para a apresentação do painel.

As artes originais vêm com fundo colorido, cubos de gelo e bolhas. Aqui o fundo sai (modelo isnet-general-use do
rembg) e fica só o personagem principal (o maior pedaço; cubos e bolhas soltos saem). Borda com esfumado curto.
Saída: img/cliente/recorte/mascote-*.webp, transparentes, 440 px de altura.

Precisa do rembg (pip install rembg onnxruntime). Não roda no servidor: é só para gerar as imagens.
Uso: python recortar-mascotes.py
"""
import glob
import os

import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy.ndimage import binary_fill_holes, binary_opening, gaussian_filter, label

AQUI = os.path.dirname(os.path.abspath(__file__))
ORIGEM = os.path.join(AQUI, "..", "img", "cliente")
SAIDA = os.path.join(ORIGEM, "recorte")
ALTURA = 440

os.makedirs(SAIDA, exist_ok=True)
sessao = new_session("isnet-general-use")
for caminho in sorted(glob.glob(os.path.join(ORIGEM, "mascote-*.webp"))):
    nome = os.path.basename(caminho)
    if nome == "mascote-laranja-logo.webp":
        continue  # o recorte pega só o letreiro "KING GELO", não o personagem
    rgb = Image.open(caminho).convert("RGB")
    m = np.asarray(remove(rgb, session=sessao, only_mask=True).convert("L")).astype(float) / 255
    # máscara sólida do maior pedaço (o mascote); buracos internos preenchidos
    solido = binary_fill_holes(binary_opening(m > 0.4, iterations=2))
    rotulos, n = label(solido)
    if n > 1:
        tam = np.bincount(rotulos.ravel())
        tam[0] = 0
        solido = rotulos == tam.argmax()
    alfa = np.clip(gaussian_filter(solido.astype(float), 1.2) * 1.2, 0, 1)
    img = Image.fromarray(np.dstack([np.asarray(rgb), (alfa * 255).astype(np.uint8)]), "RGBA")
    img = img.crop(img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
    img = img.resize((round(img.width * ALTURA / img.height), ALTURA), Image.LANCZOS)
    img.save(os.path.join(SAIDA, nome), quality=88, method=6)
    print(nome, img.size, "pedaços:", n)
