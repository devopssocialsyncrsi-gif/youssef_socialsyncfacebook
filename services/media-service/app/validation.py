from pathlib import Path

ALLOWED = {".png": "image/png", ".mp4": "video/mp4", ".mp3": "audio/mpeg"}


def validate_upload(filename: str, mime_type: str, header: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    expected = ALLOWED.get(suffix)
    if not expected or mime_type.lower().split(";")[0].strip() != expected:
        raise ValueError("Only PNG, MP4 and MP3 files with matching MIME types are supported.")
    valid = (
        (suffix == ".png" and header.startswith(b"\x89PNG\r\n\x1a\n"))
        or (suffix == ".mp4" and len(header) >= 12 and header[4:8] == b"ftyp")
        or (suffix == ".mp3" and (header.startswith(b"ID3") or (len(header) >= 2 and header[0] == 0xFF and header[1] & 0xE0 == 0xE0)))
    )
    if not valid:
        raise ValueError("The file contents do not match its declared type.")
    return expected
