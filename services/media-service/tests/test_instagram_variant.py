import uuid
from pathlib import Path
from types import SimpleNamespace
from app import main


def test_instagram_png_variant_is_jpeg_and_is_cleaned_up(tmp_path, monkeypatch):
    ident = uuid.uuid4()
    source = tmp_path / f"{ident}.png"
    source.write_bytes(b"\x89PNG\r\n\x1a\nexample")
    media = SimpleNamespace(id=ident, mime_type="image/png", stored_path=str(source), converted_path=None)
    class FakeDb:
        def get(self, _model, _id):
            return media
        def delete(self, _media):
            pass
        def commit(self):
            pass
    def fake_ffmpeg(command, **_kwargs):
        Path(command[-1]).write_bytes(b"\xff\xd8\xffjpeg")
        return SimpleNamespace(returncode=0)
    monkeypatch.setattr(main.subprocess, "run", fake_ffmpeg)
    response = main.media_file(ident, SimpleNamespace(headers={}, method="HEAD"), "instagram", FakeDb())
    jpeg = tmp_path / f"{ident}-instagram.jpg"
    assert response.media_type == "image/jpeg"
    assert jpeg.read_bytes().startswith(b"\xff\xd8\xff")
    assert main.delete_media(ident, FakeDb()).status_code == 204
    assert not source.exists() and not jpeg.exists()
