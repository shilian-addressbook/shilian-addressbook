"""Serve the UI and convert uploaded Excel workbooks locally."""
import json
import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zipfile import BadZipFile
from xml.etree.ElementTree import ParseError

from openpyxl.utils.exceptions import InvalidFileException

from workbook import MAX_FILE, export_contacts, import_contacts

ROOT = Path(__file__).resolve().parent
STATIC = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
}


class Handler(BaseHTTPRequestHandler):
    def send_body(self, data, mime, status=HTTPStatus.OK):
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, data, status=HTTPStatus.OK):
        self.send_body(json.dumps(data, ensure_ascii=False).encode(),
                       "application/json; charset=utf-8", status)

    def do_GET(self):
        if self.path not in STATIC:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        file, mime = STATIC[self.path]
        self.send_body((ROOT / file).read_bytes(), mime)

    def do_POST(self):
        if self.path not in ("/api/import", "/api/export"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            length = int(self.headers.get("Content-Length", "-1"))
            if not 0 <= length <= MAX_FILE:
                raise ValueError("文件或请求不能超过 5 MB。")
            data = self.rfile.read(length)
            if self.path == "/api/import":
                self.send_json(import_contacts(data))
            else:
                self.send_body(export_contacts(json.loads(data)),
                               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        except ValueError as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
        except (BadZipFile, InvalidFileException, ParseError, KeyError, TypeError,
                OSError, IndexError, AttributeError, StopIteration):
            self.send_json({"error": "数据格式不正确，请使用有效的 .xlsx 工作簿或通讯录数据。"},
                           HTTPStatus.BAD_REQUEST)


if __name__ == "__main__":
    host = os.environ.get("SHILIAN_HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8765"))
    with ThreadingHTTPServer((host, port), Handler) as server:
        print(f"Address book: http://{host}:{port}", flush=True)
        server.serve_forever()
