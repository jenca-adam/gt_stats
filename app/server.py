from flask import Flask, request, render_template, abort
import gt_api
import json
import requests
import base64

with open("credentials.json","r") as f:
    credentials = json.load(f)

client = gt_api.Client.login(credentials['username'], credentials['password'])

app = Flask(__name__, static_folder="static")

@app.route("/")
def index():
    return render_template("index.html")
@app.route("/proxy/gt/<path:url>", methods=["GET","POST"])
def gt_proxy(url, retries=0):
    global client
    server = request.args.get("server", "api")
    enc = request.args.get("enc") == "true"
    if "params" in request.args:
        params = json.loads(base64.b64decode(request.args["params"]))
    else:
        params = {}
    url = f"https://{server}.geotastic.net/{url}"
    kwargs = {}
    if request.method == "POST":
        data = request.json
        if enc:
            data = {"enc": gt_api.generic.encode_encdata(data)}
        kwargs["json"] = data
    try:
        response = gt_api.generic.process_response(
            gt_api.generic.geotastic_api_request(
                url, request.method, client.auth_token, params=params, **kwargs
            )
        )
    except gt_api.errors.GeotasticAPIError as e:
        if "invalid token" in str(e):
            client = gt_api.Client.login(credentials['username'], credentials['password'])
            return gt_proxy(url)
        return {"status": "error", "message": str(e), "response": None}
    except requests.exceptions.ConnectionError:
        return {"status": "error", "message": "failed to connect", "response": ""}, 503
    return {"status": "ok", "message": "", "response": response}

@app.route("/stats/<string:uid>")
def stats(uid):
    global client
    try:
        user_data = client.get_public_user_info(uid)
    except gt_api.errors.GeotasticAPIError as e:
        if "invalid token" in str(e):
            client = gt_api.Client.login(credentials['username'], credentials['password'])
            return stats(uid)
        return abort(400)
    except:
        return abort(400)
    return render_template("stats.html", uid=uid, public_user_data=user_data)

app.run(port=5000, debug=True)
