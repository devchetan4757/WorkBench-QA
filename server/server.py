from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import time
import traceback
import urllib3
import asyncio
import aiohttp
import socket
import ssl
import threading

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)

CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": False
    }
})


@app.route("/")
def home():
    return jsonify({"status": "OK", "body": "Flask backend running"})


def get_input(key, default=""):
    if request.is_json:
        data = request.get_json(silent=True) or {}
        return data.get(key, default)
    return request.form.get(key, default)


def clean_headers(raw_headers):
    if isinstance(raw_headers, dict):
        headers = raw_headers
    else:
        try:
            headers = json.loads(raw_headers)
            if not isinstance(headers, dict):
                headers = {}
        except Exception:
            headers = {}

    blocked = {"host", "content-length", "transfer-encoding", "connection"}
    headers = {k: v for k, v in headers.items() if k.lower() not in blocked}
    headers.setdefault("User-Agent", "QA-Workbench/1.0")
    headers.setdefault("Accept", "*/*")
    headers["Connection"] = "close"
    return headers


# =========================
# MAIN API — sequential
# =========================
@app.route("/api/request", methods=["POST"])
def api_request():
    try:
        url         = get_input("url", "").strip()
        method      = get_input("method", "GET").upper()
        body        = get_input("body", "")
        raw_headers = get_input("headers", "{}")

        if not url:
            return jsonify({"status": "ERROR", "body": "Missing URL", "headers": {}, "size": 0, "time": 0, "final_url": ""}), 400

        if not url.startswith(("http://", "https://")):
            return jsonify({"status": "ERROR", "body": "URL must start with http:// or https://", "headers": {}, "size": 0, "time": 0, "final_url": ""}), 400

        headers = clean_headers(raw_headers)

        session = requests.Session()
        start = time.time()

        request_kwargs = dict(headers=headers, timeout=(30, 60), allow_redirects=True, verify=False)

        if method == "GET":
            r = session.get(url, **request_kwargs)
        elif method == "POST":
            r = session.post(url, data=body, **request_kwargs)
        elif method == "PUT":
            r = session.put(url, data=body, **request_kwargs)
        elif method == "PATCH":
            r = session.patch(url, data=body, **request_kwargs)
        elif method == "DELETE":
            r = session.delete(url, **request_kwargs)
        elif method == "HEAD":
            r = session.head(url, **request_kwargs)
        else:
            return jsonify({"status": "ERROR", "body": f"Unsupported method: {method}", "headers": {}, "size": 0, "time": 0, "final_url": url}), 400

        elapsed = round((time.time() - start) * 1000, 2)
        response_text = r.text
        truncated = False
        if len(response_text) > 500_000:
            response_text = response_text[:500_000] + "\n\n...[TRUNCATED]..."
            truncated = True

        return jsonify({
            "status": r.status_code,
            "body": response_text,
            "headers": dict(r.headers),
            "size": len(r.text),
            "time": elapsed,
            "final_url": r.url,
            "truncated": truncated
        })

    except requests.exceptions.ConnectTimeout:
        return jsonify({"status": "TIMEOUT", "body": "Connection timed out.", "headers": {}, "size": 0, "time": 0, "final_url": ""}), 504

    except requests.exceptions.ReadTimeout:
        return jsonify({"status": "TIMEOUT", "body": "Read timed out.", "headers": {}, "size": 0, "time": 0, "final_url": ""}), 504

    except requests.exceptions.ConnectionError as e:
        return jsonify({"status": "ERROR", "body": f"Connection error: {str(e)}", "headers": {}, "size": 0, "time": 0, "final_url": ""}), 502

    except Exception:
        return jsonify({"status": "ERROR", "body": traceback.format_exc(), "headers": {}, "size": 0, "time": 0, "final_url": ""}), 500


# =========================
# RACE API — parallel with gate
# =========================
@app.route("/api/race", methods=["POST"])
def api_race():
    try:
        data = request.get_json(silent=True) or {}
        requests_list = data.get("requests", [])

        if not requests_list:
            return jsonify({"status": "ERROR", "body": "No requests provided"}), 400

        async def send_one(session, r, event):
            await event.wait()
            start = time.time()
            try:
                async with session.request(
                    method=r.get("method", "GET"),
                    url=r["url"],
                    headers=r.get("headers", {}),
                    data=r.get("body", "") or None,
                    ssl=False,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as resp:
                    body = await resp.text()
                    truncated = False
                    if len(body) > 500_000:
                        body = body[:500_000] + "\n\n...[TRUNCATED]..."
                        truncated = True
                    return {
                        "status": resp.status,
                        "body": body,
                        "headers": dict(resp.headers),
                        "size": len(body),
                        "time": round((time.time() - start) * 1000, 2),
                        "final_url": str(resp.url),
                        "truncated": truncated
                    }
            except asyncio.TimeoutError:
                return {"status": "TIMEOUT", "body": "Request timed out.", "headers": {}, "size": 0, "time": 0, "final_url": r.get("url", "")}
            except Exception as e:
                return {"status": "ERROR", "body": str(e), "headers": {}, "size": 0, "time": 0, "final_url": r.get("url", "")}

        async def fire_all(reqs):
            event = asyncio.Event()
            connector = aiohttp.TCPConnector(limit=0, force_close=False)
            async with aiohttp.ClientSession(connector=connector) as session:
                tasks = [send_one(session, r, event) for r in reqs]
                await asyncio.sleep(0.05)
                event.set()
                return await asyncio.gather(*tasks)

        results = asyncio.run(fire_all(requests_list))
        return jsonify(results)

    except Exception:
        return jsonify({"status": "ERROR", "body": traceback.format_exc()}), 500


# =========================
# LAST-BYTE SYNC API
# =========================
@app.route("/api/lastbyte", methods=["POST"])
def api_lastbyte():
    try:
        data = request.get_json(silent=True) or {}
        requests_list = data.get("requests", [])

        if not requests_list:
            return jsonify({"status": "ERROR", "body": "No requests provided"}), 400

        async def send_lastbyte(session, r, barrier):
            url = r["url"]
            method = r.get("method", "POST")
            headers = r.get("headers", {})
            headers["Connection"] = "keep-alive"
            body = r.get("body", "") or ""

            if body:
                body_start = body[:-1].encode()
                last_byte = body[-1].encode()
            else:
                body_start = b""
                last_byte = b" "

            async def body_gen():
                yield body_start
                await barrier.wait()  # blocks until ALL reach here
                yield last_byte       # all release simultaneously

            start = time.time()
            try:
                async with session.request(
                    method=method,
                    url=url,
                    headers=headers,
                    data=body_gen(),
                    ssl=False,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as resp:
                    body_resp = await resp.text()
                    truncated = False
                    if len(body_resp) > 500_000:
                        body_resp = body_resp[:500_000] + "\n\n...[TRUNCATED]..."
                        truncated = True
                    return {
                        "status": resp.status,
                        "body": body_resp,
                        "headers": dict(resp.headers),
                        "size": len(body_resp),
                        "time": round((time.time() - start) * 1000, 2),
                        "final_url": str(resp.url),
                        "truncated": truncated
                    }
            except asyncio.TimeoutError:
                return {"status": "TIMEOUT", "body": "Request timed out.", "headers": {}, "size": 0, "time": 0, "final_url": r.get("url", "")}
            except Exception as e:
                return {"status": "ERROR", "body": str(e), "headers": {}, "size": 0, "time": 0, "final_url": r.get("url", "")}

        async def fire_all(reqs):
            barrier = asyncio.Barrier(len(reqs))
            connector = aiohttp.TCPConnector(limit=0, force_close=False)
            async with aiohttp.ClientSession(connector=connector) as session:
                tasks = [send_lastbyte(session, r, barrier) for r in reqs]
                return await asyncio.gather(*tasks)

        results = asyncio.run(fire_all(requests_list))
        return jsonify(results)

    except Exception:
        return jsonify({"status": "ERROR", "body": traceback.format_exc()}), 500


# =========================
# START
# =========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, threaded=True)
