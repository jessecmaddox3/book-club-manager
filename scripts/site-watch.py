#!/usr/bin/env python3
"""Explicitly configured, read-only checks. Heartbeats follow successful checks."""
import datetime
import html
import json
import os
from pathlib import Path
import tempfile
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        return None


def fetch(url, headers):
    request = urllib.request.Request(url, headers={"User-Agent": "book-club-manager-watch/1", **headers})
    opener = urllib.request.build_opener(NoRedirect)
    try:
        response = opener.open(request, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.code, response.headers, response.read(1024 * 1024)


def origin(value):
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise ValueError("Configure an HTTPS origin without a path or credentials")
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))


def check_site(site, club_name, cron_secret, ping_url=None, redirect_origin=None, request=fetch):
    stage = "configuration"
    try:
        site = origin(site)
        alias = origin(redirect_origin) if redirect_origin else None
        if not club_name.strip() or not cron_secret:
            raise ValueError("Club name and cron secret are required")
        if alias == site:
            raise ValueError("Redirect origin must differ from the club origin")
        if ping_url:
            parsed = urllib.parse.urlsplit(ping_url)
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
                raise ValueError("Heartbeat must be an explicit HTTPS URL")
        stage = "login"
        status, _, body = request(site + "/login", {})
        if status != 200 or club_name not in html.unescape(body.decode("utf-8", errors="strict")):
            raise ValueError("Unexpected login page")
        if alias:
            stage = "redirect"
            status, headers, _ = request(alias + "/survey", {})
            if status not in (301, 308) or headers.get("Location") != site + "/survey":
                raise ValueError("Unexpected redirect")
        stage = "database"
        status, _, body = request(site + "/api/cron/keepalive", {"Authorization": "Bearer " + cron_secret})
        if status != 200 or json.loads(body).get("ok") is not True:
            raise ValueError("Database check failed")
        if ping_url:
            stage = "heartbeat"
            status, _, _ = request(ping_url, {})
            if status != 200:
                raise ValueError("Heartbeat was not accepted")
        return {"ok": True, "stage": "complete", "heartbeat": bool(ping_url)}
    except Exception as error:
        # Never put URLs, response bodies or credentials into status output.
        return {"ok": False, "stage": stage, "error": type(error).__name__}


def main():
    result = check_site(os.environ.get("BOOKCLUB_ORIGIN", ""), os.environ.get("BOOKCLUB_NAME", ""), os.environ.get("CRON_SECRET", ""), os.environ.get("BOOKCLUB_HEARTBEAT_URL"), os.environ.get("BOOKCLUB_REDIRECT_ORIGIN"))
    result["at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    text = json.dumps(result)
    configured = os.environ.get("BOOKCLUB_WATCH_DIRECTORY")
    if configured:
        state = Path(configured)
        state.mkdir(parents=True, exist_ok=True, mode=0o700)
        if state.is_symlink() or not state.is_dir():
            raise ValueError("Status directory must be an ordinary folder")
        with tempfile.NamedTemporaryFile(mode="w", dir=state, prefix="status-", suffix=".tmp", delete=False) as file:
            file.write(text + "\n")
            file.flush()
            os.fsync(file.fileno())
            temporary = Path(file.name)
        temporary.replace(state / "status.json")
    print(text)
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
