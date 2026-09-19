"""Monitoring never forwards secrets or reports a failed check as healthy."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("site_watch", Path(__file__).parents[1] / "scripts/site-watch.py")
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)
SITE = "https://club.example"
ALIAS = "https://www.club.example"
PING = "https://heartbeat.example/invented-token"


class SiteWatchTests(unittest.TestCase):
    def exercise(self, broken=None, ping=PING, alias=ALIAS):
        requests = []
        responses = {
            SITE + "/login": (200, {}, b"<h1>Lantern &amp; Pages</h1>"),
            ALIAS + "/survey": (308, {"Location": SITE + "/survey"}, b""),
            SITE + "/api/cron/keepalive": (200, {}, b'{"ok":true}'),
            PING: (200, {}, b"OK"),
        }
        if broken:
            responses[broken[0]] = broken[1]
        def fetch(url, headers):
            requests.append((url, headers))
            response = responses[url]
            if isinstance(response, Exception):
                raise response
            return response
        return monitor.check_site(SITE, "Lantern & Pages", "invented-secret", ping, alias, fetch), requests

    def test_success_checks_database_before_optional_heartbeat(self):
        result, requests = self.exercise()
        self.assertTrue(result["ok"])
        self.assertEqual(requests[-1][0], PING)
        self.assertEqual([(url, h) for url, h in requests if "Authorization" in h], [(SITE + "/api/cron/keepalive", {"Authorization": "Bearer invented-secret"})])

    def test_failures_do_not_ping_or_leak(self):
        for broken in [(SITE + "/login", (200, {}, b"Another site")), (ALIAS + "/survey", (308, {"Location": "https://outside.example"}, b"")), (SITE + "/api/cron/keepalive", (200, {}, b'{"ok":false}')), (SITE + "/api/cron/keepalive", OSError("invented-secret"))]:
            with self.subTest(path=broken[0]):
                result, requests = self.exercise(broken)
                self.assertFalse(result["ok"])
                self.assertNotIn("invented-secret", str(result))
                self.assertFalse(any(url == PING for url, _ in requests))

    def test_optional_checks_are_not_invented(self):
        result, requests = self.exercise(ping=None, alias=None)
        self.assertTrue(result["ok"])
        self.assertFalse(result["heartbeat"])
        self.assertEqual(len(requests), 2)

    def test_invalid_configuration_never_requests_anything(self):
        for site in ["", "http://club.example", "https://user:password@club.example", SITE + "/private"]:
            requests = []
            result = monitor.check_site(site, "Lantern", "secret", request=lambda *args: requests.append(args))
            self.assertFalse(result["ok"])
            self.assertEqual(requests, [])
        result = monitor.check_site(SITE, "Lantern", "secret", ping_url="http://heartbeat.example", request=lambda *_: self.fail("Unexpected request"))
        self.assertFalse(result["ok"])


if __name__ == "__main__":
    unittest.main()
