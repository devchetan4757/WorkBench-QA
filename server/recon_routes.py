# recon_routes.py  –  Flask Blueprint for directory recon / gobuster-style scanning
# Register in your main app.py with:
#   from recon_routes import recon_bp
#   app.register_blueprint(recon_bp)

from flask import Blueprint, request, jsonify
import requests as req_lib
import asyncio
import aiohttp
import time
import traceback
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

recon_bp = Blueprint("recon", __name__)


def clean_recon_headers(raw: dict) -> dict:
    blocked = {"host", "content-length", "transfer-encoding", "connection"}
    headers = {k: v for k, v in raw.items() if k.lower() not in blocked}
    headers.setdefault("User-Agent", "gobuster-clone/1.0")
    headers.setdefault("Accept", "*/*")
    headers["Connection"] = "close"
    return headers


# ──────────────────────────────────────────────────────────────
# /api/recon/scan  –  async parallel directory brute-force
#   Body (JSON):
#   {
#     "base_url":        "https://target.com",
#     "paths":           ["admin", "login", ...],
#     "headers":         {"User-Agent": "..."},   (optional)
#     "follow_redirects": false,                  (optional)
#     "threads":         20,                      (optional, default 20)
#     "filter_codes":    [404]                    (optional, codes to DROP)
#   }
# ──────────────────────────────────────────────────────────────
@recon_bp.route("/api/recon/scan", methods=["POST"])
def recon_scan():
    try:
        data = request.get_json(silent=True) or {}
        base_url       = data.get("base_url", "").rstrip("/")
        paths          = data.get("paths", [])
        raw_headers    = data.get("headers", {})
        follow_redir   = bool(data.get("follow_redirects", False))
        threads        = min(int(data.get("threads", 20)), 100)
        filter_codes   = set(data.get("filter_codes", [404]))

        if not base_url:
            return jsonify({"error": "base_url required"}), 400
        if not paths:
            return jsonify({"error": "paths list required"}), 400
        if not base_url.startswith(("http://", "https://")):
            return jsonify({"error": "base_url must start with http:// or https://"}), 400

        headers = clean_recon_headers(raw_headers if isinstance(raw_headers, dict) else {})

        async def probe(session: aiohttp.ClientSession, path: str) -> dict:
            url = f"{base_url}/{path.lstrip('/')}"
            start = time.time()
            try:
                async with session.get(
                    url,
                    headers=headers,
                    allow_redirects=follow_redir,
                    ssl=False,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    body = await resp.text(errors="replace")
                    truncated = False
                    if len(body) > 200_000:
                        body = body[:200_000] + "\n\n…[TRUNCATED]"
                        truncated = True
                    return {
                        "path":     path,
                        "url":      url,
                        "status":   resp.status,
                        "size":     len(body),
                        "time":     round((time.time() - start) * 1000, 2),
                        "final_url": str(resp.url),
                        "headers":  dict(resp.headers),
                        "body":     body,
                        "truncated": truncated,
                    }
            except asyncio.TimeoutError:
                return {
                    "path": path, "url": url, "status": "TIMEOUT",
                    "size": 0, "time": round((time.time() - start) * 1000, 2),
                    "final_url": url, "headers": {}, "body": "Timed out.", "truncated": False,
                }
            except Exception as e:
                return {
                    "path": path, "url": url, "status": "ERR",
                    "size": 0, "time": round((time.time() - start) * 1000, 2),
                    "final_url": url, "headers": {}, "body": str(e), "truncated": False,
                }

        async def run_all(all_paths):
            sem = asyncio.Semaphore(threads)
            connector = aiohttp.TCPConnector(limit=0, ssl=False)
            results = []

            async def bounded(path):
                async with sem:
                    return await probe(session, path)

            async with aiohttp.ClientSession(connector=connector) as session:
                tasks = [bounded(p) for p in all_paths]
                results = await asyncio.gather(*tasks)

            return results

        all_results = asyncio.run(run_all(paths))

        # server-side filter (client also filters, belt-and-suspenders)
        filtered = [r for r in all_results if r["status"] not in filter_codes]

        return jsonify({
            "total":    len(all_results),
            "filtered": len(all_results) - len(filtered),
            "results":  filtered,
        })

    except Exception:
        return jsonify({"error": traceback.format_exc()}), 500


# ──────────────────────────────────────────────────────────────
# /api/recon/stream  –  Server-Sent Events for live results
#   Same body as /api/recon/scan but streams each hit as it lands
#   Client usage:
#     const es = new EventSource(url);
#     es.onmessage = e => console.log(JSON.parse(e.data));
# ──────────────────────────────────────────────────────────────
@recon_bp.route("/api/recon/stream", methods=["GET", "POST"])
def recon_stream():
    """
    Streams recon results as Server-Sent Events.
    Accepts same JSON body as /api/recon/scan via POST,
    or query params: base_url, paths (comma-sep), threads, filter_codes (comma-sep).
    """
    from flask import Response, stream_with_context
    import json
    import queue
    import threading

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
    else:
        data = {
            "base_url":     request.args.get("base_url", ""),
            "paths":        request.args.get("paths", "").split(","),
            "threads":      int(request.args.get("threads", 10)),
            "filter_codes": [int(c) for c in request.args.get("filter_codes", "404").split(",") if c.isdigit()],
            "follow_redirects": request.args.get("follow_redirects", "false") == "true",
        }

    base_url     = data.get("base_url", "").rstrip("/")
    paths        = [p.strip() for p in data.get("paths", []) if p.strip()]
    raw_headers  = data.get("headers", {})
    follow_redir = bool(data.get("follow_redirects", False))
    threads      = min(int(data.get("threads", 10)), 100)
    filter_codes = set(data.get("filter_codes", [404]))

    headers = clean_recon_headers(raw_headers if isinstance(raw_headers, dict) else {})

    result_queue = queue.Queue()
    DONE_SENTINEL = object()

    def run_scan():
        async def probe(session, path):
            url = f"{base_url}/{path.lstrip('/')}"
            start = time.time()
            try:
                async with session.get(
                    url, headers=headers,
                    allow_redirects=follow_redir, ssl=False,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    body = await resp.text(errors="replace")
                    if len(body) > 50_000:
                        body = body[:50_000] + "\n…[TRUNCATED]"
                    result_queue.put({
                        "path": path, "url": url, "status": resp.status,
                        "size": len(body), "time": round((time.time() - start) * 1000, 2),
                        "final_url": str(resp.url), "headers": dict(resp.headers),
                        "body": body,
                    })
            except asyncio.TimeoutError:
                result_queue.put({
                    "path": path, "url": url, "status": "TIMEOUT",
                    "size": 0, "time": round((time.time() - start) * 1000, 2),
                    "final_url": url, "headers": {}, "body": "Timed out.",
                })
            except Exception as e:
                result_queue.put({
                    "path": path, "url": url, "status": "ERR",
                    "size": 0, "time": 0, "final_url": url, "headers": {}, "body": str(e),
                })

        async def run_all():
            sem = asyncio.Semaphore(threads)
            connector = aiohttp.TCPConnector(limit=0, ssl=False)
            async def bounded(p):
                async with sem:
                    await probe(session, p)
            async with aiohttp.ClientSession(connector=connector) as session:
                await asyncio.gather(*[bounded(p) for p in paths])
            result_queue.put(DONE_SENTINEL)

        asyncio.run(run_all())

    threading.Thread(target=run_scan, daemon=True).start()

    def generate():
        yield f"data: {json.dumps({'event':'start','total':len(paths)})}\n\n"
        done_count = 0
        while True:
            item = result_queue.get()
            if item is DONE_SENTINEL:
                yield f"data: {json.dumps({'event':'done','total':len(paths),'found':done_count})}\n\n"
                break
            if item["status"] not in filter_codes:
                done_count += 1
                yield f"data: {json.dumps({**item,'event':'result'})}\n\n"
            else:
                yield f"data: {json.dumps({'event':'filtered','path':item['path'],'status':item['status']})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )
