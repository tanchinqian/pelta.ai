from pathlib import Path
from pypdf import PdfReader

files = [
    Path(r"C:\Users\USER\Downloads\Full Case Studies-1.pdf"),
    Path(r"C:\Users\USER\Downloads\Preliminary Participant's Booklet.pdf"),
    Path(r"C:\Users\USER\Downloads\Judging Criteria-1.pdf"),
    Path(r"C:\Users\USER\Downloads\Pelta.ai - Amaterasu.pdf"),
    Path(r"C:\Users\USER\Downloads\Pelta.ai.pdf"),
]
out_dir = Path(r"C:\Users\USER\Desktop\Hack-Attack\tmp\pdfs")
out_dir.mkdir(parents=True, exist_ok=True)

for src in files:
    reader = PdfReader(str(src))
    chunks = []
    for i, page in enumerate(reader.pages, 1):
        chunks.append(f"\n===== PAGE {i} =====\n")
        chunks.append(page.extract_text() or "")
    out = out_dir / f"{src.stem}.txt"
    out.write_text("".join(chunks), encoding="utf-8")
    print(f"{src.name}: {len(reader.pages)} pages -> {out}")
