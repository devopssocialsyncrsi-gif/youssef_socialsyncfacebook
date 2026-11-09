import json
import logging
import os
import random
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

import httpx

log = logging.getLogger("socialsync.publisher")
LIMITS = {"linkedin": 3000, "facebook": 63206, "instagram": 2200, "youtube": 5000}


class PermanentPublishError(Exception):
    """A validation/configuration failure that should not be retried."""


@dataclass
class PublishResult:
    external_id: str
    external_url: str


def enabled(value: str) -> bool:
    return value.strip().lower() in ("1", "true", "yes", "on")


def require(name: str) -> str:
    value = os.getenv(name, "")
    if not value:
        raise PermanentPublishError(f"{name} is required when dry-run is disabled")
    return value


def validate(platform: str, post: dict, media: dict):
    if len(post["caption"]) > LIMITS[platform]:
        raise PermanentPublishError(f"{platform.title()} captions cannot exceed {LIMITS[platform]:,} characters")
    mime = media.get("publish_mime_type", media.get("mime_type"))
    if platform == "youtube" and mime != "video/mp4":
        raise PermanentPublishError("YouTube requires MP4 video; PNG images are not supported")
    if platform == "instagram" and mime not in ("image/png", "video/mp4"):
        raise PermanentPublishError("Instagram requires a PNG image or an MP4 Reel")


class PlatformAdapter(ABC):
    platform = ""

    def publish(self, post: dict, media: dict) -> PublishResult:
        validate(self.platform, post, media)
        setting = os.getenv(f"{self.platform.upper()}_DRY_RUN", "").strip()
        dry_run = enabled(setting if setting else os.getenv("DRY_RUN", "true"))
        if dry_run:
            log.info(json.dumps({"service": "publisher-service", "event": "dry_run", "platform": self.platform, "post_id": post["post_id"], "media_id": post["media_id"], "request_id": post.get("request_id"), "message": "Simulating platform upload"}))
            time.sleep(random.uniform(1, 3))
            if random.random() < 0.08:
                raise RuntimeError("Simulated transient platform error")
            ident = f"demo-{uuid.uuid4().hex[:12]}"
            base = {"linkedin": "https://www.linkedin.com/feed/", "facebook": "https://www.facebook.com/", "instagram": "https://www.instagram.com/", "youtube": "https://www.youtube.com/watch?v="}[self.platform]
            return PublishResult(ident, base + ident)
        return self.publish_real(post, media)

    @abstractmethod
    def publish_real(self, post: dict, media: dict) -> PublishResult:
        raise NotImplementedError


class LinkedInAdapter(PlatformAdapter):
    platform = "linkedin"

    def publish_real(self, post, media):
        token, owner = require("LINKEDIN_ACCESS_TOKEN"), require("LINKEDIN_AUTHOR_URN")
        headers = {"Authorization": f"Bearer {token}", "LinkedIn-Version": os.getenv("LINKEDIN_API_VERSION", "202610"), "X-Restli-Protocol-Version": "2.0.0", "X-Request-ID": post.get("request_id", "")}
        path = Path(media["local_path"])
        with httpx.Client(timeout=180, follow_redirects=True) as client:
            is_video = media["publish_mime_type"] == "video/mp4"
            kind = "videos" if is_video else "images"
            init = {"owner": owner}
            if is_video:
                init.update({"fileSizeBytes": path.stat().st_size, "uploadCaptions": False, "uploadThumbnail": False})
            response = client.post(f"https://api.linkedin.com/rest/{kind}?action=initializeUpload", headers=headers, json={"initializeUploadRequest": init})
            response.raise_for_status()
            value = response.json()["value"]
            asset = value["video" if is_video else "image"]
            if is_video:
                etags = []
                with path.open("rb") as source:
                    for part in value["uploadInstructions"]:
                        source.seek(part["firstByte"])
                        data = source.read(part["lastByte"] - part["firstByte"] + 1)
                        uploaded = client.put(part["uploadUrl"], content=data, headers={"Content-Type": "application/octet-stream"})
                        uploaded.raise_for_status()
                        etags.append(uploaded.headers["etag"])
                final = client.post("https://api.linkedin.com/rest/videos?action=finalizeUpload", headers=headers, json={"finalizeUploadRequest": {"video": asset, "uploadToken": value.get("uploadToken", ""), "uploadedPartIds": etags}})
                final.raise_for_status()
            else:
                with path.open("rb") as source:
                    uploaded = client.put(value["uploadUrl"], content=source.read(), headers={"Authorization": f"Bearer {token}", "Content-Type": media["publish_mime_type"]})
                    uploaded.raise_for_status()
            response = client.post("https://api.linkedin.com/rest/posts", headers=headers, json={"author": owner, "commentary": post["caption"], "visibility": "PUBLIC", "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []}, "content": {"media": {"id": asset, "title": post["title"]}}, "lifecycleState": "PUBLISHED", "isReshareDisabledByAuthor": False})
            response.raise_for_status()
            ident = response.headers.get("x-restli-id", asset)
            return PublishResult(ident, f"https://www.linkedin.com/feed/update/{ident}/")


class FacebookPageAdapter(PlatformAdapter):
    platform = "facebook"

    def publish_real(self, post, media):
        token, page = require("FACEBOOK_PAGE_ACCESS_TOKEN"), require("FACEBOOK_PAGE_ID")
        is_video = media["publish_mime_type"] == "video/mp4"
        endpoint = "videos" if is_video else "photos"
        with httpx.Client(timeout=300) as client, open(media["local_path"], "rb") as source:
            data = {"description" if is_video else "caption": post["caption"]}
            if is_video:
                data["title"] = post["title"]
            response = client.post(f"https://graph.facebook.com/{os.getenv('META_API_VERSION', 'v22.0')}/{page}/{endpoint}", headers={"Authorization": f"Bearer {token}", "X-Request-ID": post.get("request_id", "")}, data=data, files={"source": (Path(media["local_path"]).name, source, media["publish_mime_type"])})
            response.raise_for_status()
            ident = response.json().get("post_id") or response.json()["id"]
            return PublishResult(ident, f"https://www.facebook.com/{ident}")


class InstagramAdapter(PlatformAdapter):
    platform = "instagram"

    def publish_real(self, post, media):
        token, account, public_base = require("INSTAGRAM_ACCESS_TOKEN"), require("INSTAGRAM_USER_ID"), require("PUBLIC_MEDIA_BASE_URL").rstrip("/")
        if not public_base.startswith("https://"):
            raise PermanentPublishError("PUBLIC_MEDIA_BASE_URL must be a publicly reachable HTTPS URL")
        root = f"https://graph.facebook.com/{os.getenv('META_API_VERSION', 'v22.0')}"
        headers = {"Authorization": f"Bearer {token}", "X-Request-ID": post.get("request_id", "")}
        is_video = media["publish_mime_type"] == "video/mp4"
        public_url = f"{public_base}/{post['media_id']}/file" + ("" if is_video else "?variant=instagram")
        data = {"caption": post["caption"], "video_url" if is_video else "image_url": public_url}
        if is_video:
            data["media_type"] = "REELS"
            data["share_to_feed"] = "true"
        with httpx.Client(timeout=30) as client:
            response = client.post(f"{root}/{account}/media", headers=headers, data=data)
            response.raise_for_status()
            container = response.json()["id"]
            for _ in range(30):
                check = client.get(f"{root}/{container}", headers=headers, params={"fields": "status_code,status"})
                check.raise_for_status()
                status = check.json().get("status_code")
                if status == "FINISHED":
                    break
                if status in ("ERROR", "EXPIRED"):
                    raise RuntimeError(f"Instagram media processing {status.lower()}")
                time.sleep(10)
            else:
                raise TimeoutError("Instagram media is still processing")
            response = client.post(f"{root}/{account}/media_publish", headers=headers, data={"creation_id": container})
            response.raise_for_status()
            ident = response.json()["id"]
            permalink = client.get(f"{root}/{ident}", headers=headers, params={"fields": "permalink"})
            url = permalink.json().get("permalink", "https://www.instagram.com/") if permalink.is_success else "https://www.instagram.com/"
            return PublishResult(ident, url)


class YouTubeAdapter(PlatformAdapter):
    platform = "youtube"

    def publish_real(self, post, media):
        token = require("YOUTUBE_ACCESS_TOKEN")
        path = Path(media["local_path"])
        size = path.stat().st_size
        headers = {"Authorization": f"Bearer {token}", "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": str(size), "X-Request-ID": post.get("request_id", "")}
        with httpx.Client(timeout=300, follow_redirects=True) as client:
            init = client.post("https://www.googleapis.com/upload/youtube/v3/videos", params={"uploadType": "resumable", "part": "snippet,status"}, headers=headers, json={"snippet": {"title": post["title"], "description": post["caption"], "categoryId": "22"}, "status": {"privacyStatus": os.getenv("YOUTUBE_PRIVACY_STATUS", "private"), "selfDeclaredMadeForKids": False}})
            init.raise_for_status()
            with path.open("rb") as source:
                response = client.put(init.headers["location"], headers={"Authorization": f"Bearer {token}", "Content-Type": "video/mp4", "Content-Length": str(size)}, content=iter(lambda: source.read(1024 * 1024), b""))
            response.raise_for_status()
            ident = response.json()["id"]
            return PublishResult(ident, f"https://www.youtube.com/watch?v={ident}")


ADAPTERS = {"linkedin": LinkedInAdapter(), "facebook": FacebookPageAdapter(), "instagram": InstagramAdapter(), "youtube": YouTubeAdapter()}
