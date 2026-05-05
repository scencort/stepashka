import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:4000/api"
EMAIL = "student@stepashka.dev"
PASSWORD = "Student@12345"


def post_json(path: str, payload: dict, token: str | None = None, timeout: int = 60):
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

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")


def login() -> str:
    status, body = post_json(
        "/auth/login",
        {"email": EMAIL, "password": PASSWORD},
        timeout=30,
    )
    if status != 200:
        raise RuntimeError(f"Не удалось авторизоваться: {status} {body}")
    data = json.loads(body)
    token = data.get("accessToken")
    if not token:
        raise RuntimeError("В ответе нет accessToken")
    return str(token)


def main():
    # Авторизуемся и проверяем endpoint как обычный пользователь системы.
    token = login()

    # Намеренно отправляем некорректный payload: нет обязательного поля sourceCode.
    status, body = post_json(
        "/ai/review/check",
        {"language": "python"},
        token=token,
        timeout=30,
    )

    print("=== test_validation_422 ===")
    print("статус:", status)
    print("тело_ответа:", body)

    if status == 422:
        print("OK: валидация сработала корректно (HTTP 422).")
    else:
        print("FAIL: ожидался HTTP 422.")


if __name__ == "__main__":
    main()
