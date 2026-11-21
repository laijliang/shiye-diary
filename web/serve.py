#!/usr/bin/env python3
"""Local dev server for 拾页日记.
Usage: python serve.py [port]
Serves the current directory with no-store caching so edits show up immediately.
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


os.chdir(os.path.dirname(os.path.abspath(__file__)))
with Server(("127.0.0.1", PORT), Handler) as httpd:
    print(f"拾页日记 running at http://127.0.0.1:{PORT}/")
    httpd.serve_forever()
