import pytest
from app.validation import validate_upload


@pytest.mark.parametrize("name,mime,header", [("x.png", "image/png", b"\x89PNG\r\n\x1a\nmore"), ("x.mp4", "video/mp4", b"\x00\x00\x00\x18ftypisom"), ("x.mp3", "audio/mpeg", b"ID3abc")])
def test_accepts_correct_signatures(name, mime, header):
    assert validate_upload(name, mime, header) == mime


@pytest.mark.parametrize("name,mime,header", [("x.png", "image/png", b"not a png"), ("x.png", "video/mp4", b"\x89PNG\r\n\x1a\n"), ("x.exe", "application/octet-stream", b"MZ")])
def test_rejects_wrong_content(name, mime, header):
    with pytest.raises(ValueError):
        validate_upload(name, mime, header)
