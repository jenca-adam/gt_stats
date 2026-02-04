const gmRequest = (async (url, method, data) => {
    const encodedUrl = btoa(url);
    const proxyUrl = "/proxy/gm?" + (new URLSearchParams({
        "url": encodedUrl
    })).toString();
    const fetchArgs = {
        method: method
    };
    if (data && method == "POST") fetchArgs.body = data;
    const response = await fetch(proxyUrl, fetchArgs);
    return response;
});
const apiRequest = (async (url, method, args) => {

    const encodedParams = btoa(JSON.stringify(args.params));
    const urlParamsDict = {
        server: args.server || "backend01",
        enc: Boolean(args.enc),
    };
    if (args.token) urlParamsDict["token"] = args.token;
    if (args.params) urlParamsDict["params"] = encodeURI(btoa(JSON.stringify(args.params)));
    const urlParams = new URLSearchParams(urlParamsDict).toString();
    const proxyUrl = "/proxy/gt" + url + "?" + urlParams;
    const fetchArgs = {
        method: method,
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
    }
    if (args.data && method == "POST") fetchArgs["body"] = JSON.stringify(args.data);
    const response = await fetch(proxyUrl, fetchArgs);
    var rjson = {};
    try {
        rjson = await response.json();
    } catch {
        rjson = {
            message: ""
        }
    }
    if (!response.ok) {
        return {
            "status": "error",
            "message": `geotastic connection failed: ${response.status} ${rjson.message}`,
            "response": null
        };
    }
    return rjson;
});


const getGameHistoryDetails = async (lobbyId) => {
    return await apiRequest("/v1/matchmaking/getGameHistoryDetails.php", "GET", {
        "params": {
            "lobbyId": lobbyId
        }
    });
};

const getPublicUserInfoByUid = async (uid) => {
    return await apiRequest("/v1/user/getPublicUserInfoByUid.php", "GET", {
        "params": {
            "uid": uid
        }
    });
};

const findUsersByNickname = async (nickname) => {
    return await apiRequest("/v1/user/getUserSuggestionsV2.php", "POST", {
        "data": {
            "term": nickname,
            "type": "nickname",
            "private": false
        },
        "enc": true
    });
};

const getRankedMatchmakingGames = async (uid, offset) => {
    return await apiRequest("/v1/matchmaking/getRankedMatchmakingGames.php", "GET", {
        "params": {
            "uid": uid,
            "offset": offset
        }
    });
};

const getCurrentUserStatistics = async (uid) => {
    return await apiRequest("/v1/season/getCurrentUserStatistics.php", "GET", {
        "params": {
            "uid": uid
        }
    });
}