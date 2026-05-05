import json
import time
import urllib.request

BASE = "http://127.0.0.1:4000/api"
EMAIL = "student@gmail.com"
PASSWORD = "Student@12345"


def post_json(path: str, payload: dict, token: str | None = None, timeout: int = 120):
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(
        url=f"{BASE}{path}",
        data=data,
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, json.loads(body)


def login() -> str:
    status, data = post_json(
        "/auth/login",
        {"email": EMAIL, "password": PASSWORD},
        timeout=30,
    )
    if status != 200 or "accessToken" not in data:
        raise RuntimeError(f"Не удалось получить accessToken: {status} {data}")
    return str(data["accessToken"])


def main():
    token = login()

    # код для теста
    payload = {
        "language": "python",
        "sourceCode": "def add(a, b):\n    return a + b\n",
    }

    # ожидаем cache miss
    t1 = time.perf_counter()
    s1, r1 = post_json("/ai/review/check", payload, token=token, timeout=180)
    d1 = time.perf_counter() - t1

    # ожидаем cache hit
    t2 = time.perf_counter()
    s2, r2 = post_json("/ai/review/check", payload, token=token, timeout=180)
    d2 = time.perf_counter() - t2

    print("=== benchmark_review_cache ===")
    print("статус_первого_запроса:", s1)
    print("статус_второго_запроса:", s2)
    print("первый_cache_hit:", r1.get("cache", {}).get("hit"))
    print("второй_cache_hit:", r2.get("cache", {}).get("hit"))
    print("время_первого_запроса_сек:", round(d1, 3))
    print("время_второго_запроса_сек:", round(d2, 3))
    print("ускорение_x:", round(d1 / d2, 2) if d2 > 0 else "inf")


if __name__ == "__main__":
    main()
