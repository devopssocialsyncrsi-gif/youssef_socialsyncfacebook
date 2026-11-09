import uuid
from types import SimpleNamespace
from app import main


class FakeSession:
    def __init__(self):
        self.post = None
    def add(self, post):
        self.post = post
    def commit(self):
        pass


class FakeQueue:
    def __init__(self):
        self.jobs = []
    def ping(self):
        return True
    def lpush(self, key, job):
        self.jobs.append((key, job))


def test_post_creation_queues_one_job_per_target(monkeypatch):
    fake_queue = FakeQueue()
    monkeypatch.setattr(main, "queue", fake_queue)
    monkeypatch.setattr(main, "verify_media", lambda *_: None)
    session = FakeSession()
    payload = main.PostCreate(title="Launch day", caption="Hello", media_id=uuid.uuid4(), platforms=["linkedin", "youtube"])
    result = main.create_post(payload, SimpleNamespace(state=SimpleNamespace(request_id="req-1")), session)
    assert result["status"] == "pending"
    assert len(result["targets"]) == 2
    assert len(fake_queue.jobs) == 2
    assert all(key == "publish_jobs" for key, _ in fake_queue.jobs)
    assert all('"request_id": "req-1"' in job for _, job in fake_queue.jobs)
