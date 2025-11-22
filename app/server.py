from flask import Flask, request, render_template, abort
import gt_api
import json
import requests
import base64
import threading
import time
with open("credentials.json","r") as f:
    credentials = json.load(f)

app = Flask(__name__, static_folder="static")


client_lock = threading.Lock()
refresh_lock = threading.Lock()
last_update = 0
client = None
def get_client(force_refresh=False):
    """
    Returns a logged-in client, refreshing the token only when required.
    Thread-safe.
    """
    global client, last_update
    with client_lock:
        print("NEXT", last_update)
        if client is None or (force_refresh and last_update<time.time()-1):
            print("need update")
            try:
                client = gt_api.Client.login(credentials['username'], credentials['password'])
                last_update = time.time()
            except Exception as e:
                raise RuntimeError(f"Login failed: {e}")

        return client

client = get_client()

def safe_api_call(full_url, method, params, kwargs):
    global client

    try:
        return gt_api.generic.process_response(gt_api.generic.geotastic_api_request(full_url, method, client.auth_token, params=params, **kwargs))
    except gt_api.errors.GeotasticAPIError as e:
        print(e)
        if "invalid token" in str(e).lower():
            print("refreshing", getattr(client,'auth_token', None))
            client = get_client(force_refresh=True)
            print("new", client.auth_token)
            return safe_api_call(full_url, method, params, kwargs)
        
        raise


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/proxy/gt/<path:url>", methods=["GET", "POST"])
def gt_proxy(url):
    client = get_client()
    server = request.args.get("server", "api")
    enc = request.args.get("enc") == "true"

    if "params" in request.args:
        params = json.loads(base64.b64decode(request.args["params"]))
    else:
        params = {}

    full_url = f"https://{server}.geotastic.net/{url}"

    kwargs = {}

    if request.method == "POST":
        data = request.json
        if enc:
            data = {"enc": gt_api.generic.encode_encdata(data)}
        kwargs["json"] = data

    try:
        response = safe_api_call(
                full_url, request.method, params, kwargs
        )

    except requests.exceptions.ConnectionError:
        return {"status": "error", "message": "failed to connect", "response": ""}, 503
    except gt_api.errors.GeotasticAPIError as e:
        return {"status": "error", "message": str(e), "response": None}, 400

    return {"status": "ok", "message": "", "response": response}


@app.route("/stats/<string:uid>")
def stats(uid):
    client = get_client()

    try:
        user_data = safe_api_call("https://backend01.geotastic.net/v1/user/getPublicUserInfoByUid.php", "GET", {"uid":uid}, {})
    except gt_api.errors.GeotasticAPIError:
        abort(400)
    except Exception:
        abort(400)

    return render_template("stats.html", uid=uid, public_user_data=user_data)


if __name__=="__main__":app.run(port=5000)

