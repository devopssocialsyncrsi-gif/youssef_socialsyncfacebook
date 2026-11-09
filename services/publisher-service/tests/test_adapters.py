import pytest
from app import adapters


@pytest.mark.parametrize("platform", ["linkedin", "facebook", "instagram", "youtube"])
def test_dry_run_publishes_without_credentials(platform, monkeypatch):
    monkeypatch.setenv("DRY_RUN", "true")
    monkeypatch.delenv(f"{platform.upper()}_DRY_RUN", raising=False)
    monkeypatch.setattr(adapters.time, "sleep", lambda _: None)
    monkeypatch.setattr(adapters.random, "random", lambda: 0.5)
    post = {"post_id": "post-1", "media_id": "media-1", "title": "Hello", "caption": "Hello world", "request_id": "req-1"}
    result = adapters.ADAPTERS[platform].publish(post, {"publish_mime_type": "video/mp4"})
    assert result.external_id.startswith("demo-")
    assert result.external_url.startswith("https://")


def test_youtube_rejects_png():
    with pytest.raises(adapters.PermanentPublishError, match="YouTube requires MP4"):
        adapters.validate("youtube", {"caption": "test"}, {"publish_mime_type": "image/png"})


def test_caption_limit():
    with pytest.raises(adapters.PermanentPublishError, match="2,200"):
        adapters.validate("instagram", {"caption": "x" * 2201}, {"publish_mime_type": "video/mp4"})
