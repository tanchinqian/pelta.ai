from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import pypdfium2 as pdfium

sources = [
    Path(r"C:\Users\USER\Downloads\Pelta.ai - Amaterasu.pdf"),
    Path(r"C:\Users\USER\Downloads\Pelta.ai.pdf"),
]
root = Path(r"C:\Users\USER\Desktop\Hack-Attack\tmp\pdfs\review")
root.mkdir(parents=True, exist_ok=True)

for src in sources:
    folder = root / src.stem
    folder.mkdir(exist_ok=True)
    doc = pdfium.PdfDocument(str(src))
    thumbs = []
    for i, page in enumerate(doc):
        image = page.render(scale=1.25).to_pil().convert("RGB")
        out = folder / f"page-{i+1:02d}.png"
        image.save(out)
        thumb = image.copy()
        thumb.thumbnail((360, 260))
        canvas = Image.new("RGB", (380, 300), "white")
        canvas.paste(thumb, ((380-thumb.width)//2, 20))
        ImageDraw.Draw(canvas).text((12, 278), f"Page {i+1}", fill="black")
        thumbs.append(canvas)
    cols = 3
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols*380, rows*300), "white")
    for i, thumb in enumerate(thumbs):
        sheet.paste(thumb, ((i%cols)*380, (i//cols)*300))
    sheet.save(root / f"{src.stem}-contact-sheet.png")
    print(src.name, len(doc), "pages")
