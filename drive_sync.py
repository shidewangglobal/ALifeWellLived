from __future__ import annotations

import re
from pathlib import Path

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload


FOLDER_ID = "1Q6Em3cwKw5BV4cgz1VkTqJA4K7cgIM8l"

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
]


def slugify(name: str) -> str:
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9À-ỹ]+", "-", name)
    name = re.sub(r"-{2,}", "-", name).strip("-")
    return name or "doc"


def main() -> None:
    base = Path(__file__).resolve().parents[1]
    out_dir = base / "knowledge" / "_drive"
    out_dir.mkdir(parents=True, exist_ok=True)

    sa_path = base / "service-account.json"
    if not sa_path.exists():
        raise SystemExit(
            "Thiếu file service-account.json.\n"
            "Bạn tạo service account, tải JSON, đặt vào joy/service-account.json,\n"
            "sau đó share folder Drive cho email của service account."
        )

    creds = Credentials.from_service_account_file(str(sa_path), scopes=SCOPES)
    drive = build("drive", "v3", credentials=creds)

    q = f"'{FOLDER_ID}' in parents and trashed = false"
    page_token = None
    items: list[dict] = []
    while True:
        resp = (
            drive.files()
            .list(
                q=q,
                fields="nextPageToken, files(id, name, mimeType, modifiedTime)",
                pageToken=page_token,
            )
            .execute()
        )
        items.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    for f in items:
        file_id = f["id"]
        name = f.get("name") or "untitled"
        mime = f.get("mimeType") or ""

        if mime == "application/vnd.google-apps.document":
            request = drive.files().export_media(fileId=file_id, mimeType="text/plain")
            path = out_dir / f"{slugify(name)}__{file_id}.txt"
            with path.open("wb") as fh:
                downloader = MediaIoBaseDownload(fh, request)
                done = False
                while not done:
                    _, done = downloader.next_chunk()
            continue

        if mime == "application/vnd.google-apps.presentation":
            request = drive.files().export_media(fileId=file_id, mimeType="text/plain")
            path = out_dir / f"{slugify(name)}__{file_id}.txt"
            with path.open("wb") as fh:
                downloader = MediaIoBaseDownload(fh, request)
                done = False
                while not done:
                    _, done = downloader.next_chunk()
            continue

        # PDF/Sheet/Images: bỏ qua ở bản sync này.

    print(f"Đã đồng bộ xong. Output: {out_dir}")


if __name__ == "__main__":
    main()

from __future__ import annotations

import re
from pathlib import Path

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload


FOLDER_ID = "1Q6Em3cwKw5BV4cgz1VkTqJA4K7cgIM8l"

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
]


def slugify(name: str) -> str:
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9À-ỹ]+", "-", name)
    name = re.sub(r"-{2,}", "-", name).strip("-")
    return name or "doc"


def main() -> None:
    base = Path(__file__).resolve().parents[1]
    out_dir = base / "knowledge" / "_drive"
    out_dir.mkdir(parents=True, exist_ok=True)

    sa_path = base / "service-account.json"
    if not sa_path.exists():
        raise SystemExit(
            "Thiếu file service-account.json.\n"
            "Bạn tạo service account, tải JSON, đặt vào joy/service-account.json,\n"
            "sau đó share folder Drive cho email của service account."
        )

    creds = Credentials.from_service_account_file(str(sa_path), scopes=SCOPES)
    drive = build("drive", "v3", credentials=creds)

    q = f"'{FOLDER_ID}' in parents and trashed = false"
    page_token = None
    items: list[dict] = []
    while True:
        resp = (
            drive.files()
            .list(
                q=q,
                fields="nextPageToken, files(id, name, mimeType, modifiedTime)",
                pageToken=page_token,
            )
            .execute()
        )
        items.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    for f in items:
        file_id = f["id"]
        name = f.get("name") or "untitled"
        mime = f.get("mimeType") or ""

        # Google Docs -> export text/plain
        if mime == "application/vnd.google-apps.document":
            request = drive.files().export_media(fileId=file_id, mimeType="text/plain")
            path = out_dir / f"{slugify(name)}__{file_id}.txt"
            fh = path.open("wb")
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            fh.close()
            continue

        # Google Slides -> export text/plain (thường kém format, vẫn hữu ích)
        if mime == "application/vnd.google-apps.presentation":
            request = drive.files().export_media(fileId=file_id, mimeType="text/plain")
            path = out_dir / f"{slugify(name)}__{file_id}.txt"
            fh = path.open("wb")
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            fh.close()
            continue

        # Các file khác (PDF, hình, sheet...) hiện bỏ qua.

    print(f"Đã đồng bộ xong. Output: {out_dir}")


if __name__ == "__main__":
    main()

