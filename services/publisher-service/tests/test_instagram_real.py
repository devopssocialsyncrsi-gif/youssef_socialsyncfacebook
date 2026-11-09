from app import adapters


def test_instagram_real_image_uses_public_jpeg_variant(monkeypatch):
    monkeypatch.setenv("INSTAGRAM_DRY_RUN", "false")
    monkeypatch.setenv("INSTAGRAM_ACCESS_TOKEN", "test-token")
    monkeypatch.setenv("INSTAGRAM_USER_ID", "test-account")
    monkeypatch.setenv("PUBLIC_MEDIA_BASE_URL", "https://example.test/api/media")
    requests = []

    class FakeResponse:
        is_success = True
        def __init__(self, data):
            self.data = data
        def json(self):
            return self.data
        def raise_for_status(self):
            pass

    class FakeClient:
        def __init__(self, **_kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *_args):
            pass
        def post(self, url, **kwargs):
            requests.append((url, kwargs.get("data", {})))
            return FakeResponse({"id": "published" if url.endswith("media_publish") else "container"})
        def get(self, url, **_kwargs):
            return FakeResponse({"status_code": "FINISHED"} if url.endswith("container") else {"permalink": "https://instagram.com/p/example"})

    monkeypatch.setattr(adapters.httpx, "Client", FakeClient)
    post = {"post_id": "post", "media_id": "media", "title": "Title", "caption": "Caption", "request_id": "req"}
    result = adapters.InstagramAdapter().publish(post, {"publish_mime_type": "image/png"})
    assert requests[0][1]["image_url"] == "https://example.test/api/media/media/file?variant=instagram"
    assert result.external_id == "published"
