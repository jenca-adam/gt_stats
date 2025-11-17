const TIER_TEXTS = ["Bronze Bird", "Silver Swan", "Gold Goose", "Platin Penguin", "Diamond Duck", "Master Mallard"];
const USER_DATA_CACHE = {};
const gameTemplate = document.querySelector("#game-template");

USER_DATA_CACHE[userUid] = userData;

function distance(lat1, lon1, lat2, lon2) {
    const r = 6371; // global avg
    const p = Math.PI / 180;

    const a = 0.5 - Math.cos((lat2 - lat1) * p) / 2 +
        Math.cos(lat1 * p) * Math.cos(lat2 * p) *
        (1 - Math.cos((lon2 - lon1) * p)) / 2;

    return 2 * r * Math.asin(Math.sqrt(a));
}
function getAvatarUrl(avatar){
    return avatar?"https://static.geo.edutastic.de/avatars/"+avatar:"https://static.geo.edutastic.de/avatar/default.png";
}
function sumHgrams(h1, h2){
    var h = Object.assign({}, h1);
    for(var k of Object.keys(h2)){
        h[k]=(h[k]||0)+h2[k];
    }
    return h;
}
class Rank {
    constructor(tier, stars) {
        this.tier = tier;
        this.stars = stars;
        this.tierText = TIER_TEXTS[tier];
        this.tierClass = `rank-${tier}`;
        this.starsText = "★".repeat(stars);
        this.text = this.tierText + ' ' + this.starsText;
    }
    static fromElo(elo) {
        let rank = Math.min(Math.floor(elo / 3000), 5);
        return new Rank(Math.floor(rank), Math.min(5, 1 + Math.floor((elo - 3000 * rank) / 600)));
    }
    get html() {
        return `<span class="rank ${this.tierClass}"><span class="rank-name">${this.tierText}</span><span class="rank-stars">${this.starsText}</span></span>`
    }
};
class Result {
    constructor(resultJson) {
        this.drop = resultJson.drop;
        this.pick = resultJson.pick;
        this.score = resultJson.score;
        this.gotCountry = this.drop.iso2 == this.pick.iso2;
        this.distance = distance(this.drop.lat, this.drop.lng, this.pick.lat, this.pick.lng);
        this.time = resultJson.time;
    }
};
class Game {
    static Player = class Player {
        // the player class is local to each game to avoid confusion
        constructor(uid, id, nick, won) {
            this.uid = uid;
            this.id = id;
            this.nick = nick;
            this.results = {};
            this.totalScore = 0;
            this.roundsGuessed = 0;
            this.won = won;
            this._userData = null;
            this.hgram = {};
            
        }
        processResult(result) {
            this.results[result.round] = new Result(result);
            if (!result.pick.iso2) {
                //don't count forgetting to guess as an actual guess
                return;
            }
            this.totalScore += result.score;
            const bucket = Math.min(23, Math.floor(result.score/250)); // we don't want 6000-ers to be in a separate bucket
            this.hgram[bucket] = (this.hgram[bucket]||0)+1;
            this.roundsGuessed++;
        }
        get userData() {
            return this._userData || (this._userData = USER_DATA_CACHE[this.uid]);
        }
        get averageScore(){
            return this.totalScore/this.roundsGuessed;
        }
        elo(mmid){
            return this.userData.seasonProgress.elo.filter(a => a.matchmakingId === mmid)[0].elo
        }
    };

    constructor(apiResponse) {
        this.players = {};
        this.lobbyId = apiResponse.lobbyId;
        this.matchmakingId = apiResponse.matchmakingId;
        for (const result of apiResponse.results) {
            if (!(result.userUid in this.players)) {
                this.players[result.userUid] = new Game.Player(result.userUid, result.userId, result.nickname, result.userId==apiResponse.winnerUserId);
            }
            this.players[result.userUid].processResult(result);
        }
    }
    get opponents(){
        return Object.keys(this.players).filter(u=>u!=userUid).map(a=>this.players[a]);
    }
    get html(){
        const node = gameTemplate.content.cloneNode(true); 
        $(node).find(".game").addClass(this.players[userUid].won?"won":"lost");
        $(node).find(".game-status").attr("data-icon", this.players[userUid].won?"mdi-check":"mdi-close");
        $(node).find(".game-opponent").text(this.opponents[0].nick);
        $(node).find(".game-opponent").attr("href",`https://geotastic.net/user-page/${this.opponents[0].uid}`);
        $(node).find(".game-opponent-rank").html(Rank.fromElo(this.opponents[0].elo(this.matchmakingId)).html);
        $(node).find(".game-score").text(this.players[userUid].averageScore.toFixed(2));
        $(node).find(".game-view").attr("href", `https://geotastic.net/game-history-details/${this.lobbyId}`);
        $(node).find(".game-opponent-avatar").attr("src", getAvatarUrl(this.opponents[0].userData.avatarImage));
        return node;
    }
    static async fromLobbyId(lobbyId) {
        return new Game((await getGameHistoryDetails(lobbyId)).response);
    }

};
class Stats {
    constructor() {
        this.ppGames = [];
        this.flagsGames = [];
        this.ppWon = 0;
        this.flagsWon = 0;
        this.ppElo = userData.seasonProgress.elo.filter(a => a.matchmakingId === 16)[0].elo;
        this.ppRank = Rank.fromElo(this.ppElo);
        this.flagsElo = userData.seasonProgress.elo.filter(a => a.matchmakingId === 15)[0].elo;
        this.flagsRank = Rank.fromElo(this.flagsElo);
    }
    bestGames(mmid){
        return (mmid==15?this.flagsGames:this.ppGames).sort((a,b)=>(b.players[userUid].averageScore-a.players[userUid].averageScore));    
    }
    bestWins(mmid){
        return (mmid==15?this.flagsGames:this.ppGames).filter(g=>(g.players[userUid].won)).sort((a,b)=>(b.opponents[0].elo(mmid)-a.opponents[0].elo(mmid)));
    }
    worstLosses(mmid){
        return (mmid==15?this.flagsGames:this.ppGames).filter(g=>(!g.players[userUid].won)).sort((a,b)=>(a.opponents[0].elo(mmid)-b.opponents[0].elo(mmid)));
    }
    async processGame(game) {
        let gameObj = await Game.fromLobbyId(game.lobbyId);
        if (game.matchmakingId == 16) {

            this.ppGames.push(gameObj);
            if (game.placement == 1) {
                this.ppWon++;
            }
        } else if (game.matchmakingId == 15) {
            this.flagsGames.push(gameObj);
            if (game.placement == 1) {
                this.flagsWon++;
            }
        }
        console.log(game);
    }
    async getPlayerData() {
        // this is called separately to make it possible to get user data asynchronously and without repeating any uids
        $("#loading-flavor").text("Fetching opponent data...");
        $("#loading-progress").val(0);
        
        const getPlayerDataSingle = async (uid) => {
            USER_DATA_CACHE[uid] || (USER_DATA_CACHE[uid] = (await getPublicUserInfoByUid(uid)).response);
            $("#loading-progress").val($("#loading-progress").val()+1);
        };
        const uidSet = new Set(this.ppGames.concat(this.flagsGames).map(game => Object.keys(game.players)).flat());
        $("#loading-progress").attr("max", uidSet.size);
        await Promise.all([...uidSet].map(uid => getPlayerDataSingle(uid)));
    }
    async showPp() {
        $("#pp-overview-games-played").text(this.ppGames.length);
        $("#pp-overview-win-rate").text((this.ppGames.length ? (100 * this.ppWon / this.ppGames.length).toFixed(2) : 0) + "%");
        $("#pp-overview-elo").text(this.ppElo);
        $("#pp-overview-rank").html(this.ppRank.html);
        const b = this.bestGames(16);
        for(const g of b.slice(0,3)){
            $("#pp-games-best-games").append(g.html);
        }
        for(const g of b.slice(b.length-3).reverse()){
            $("#pp-games-worst-games").append(g.html);
        }
        console.log(this.bestWins(16));
        console.log(this.worstLosses(16));
        for(const g of this.bestWins(16).slice(0,3)){
            $("#pp-games-best-wins").append(g.html);
        }
        for(const g of this.worstLosses(16).slice(0,3)){
            $("#pp-games-worst-losses").append(g.html);
        }
        Plotly.newPlot('pp-dist-histogram', [{x:[...Array(24).keys().map(k=>k*250)], y:this.ppHistogram, type:"bar"}]);

    }
    async showFlags() {

    }
    async show() {
        await Promise.all([this.showPp(), this.showFlags()]);
    }
    get ppHistogram(){
        const hgram = this.ppGames.map(g=>g.players[userUid].hgram).reduce(sumHgrams);
        return [...Array(24).keys().map(bucket=>hgram[bucket]||0)];
    }
};
async function getAllMatchmakingGames(uid) {
    const userStats = (await getCurrentUserStatistics(uid)).response;
    if (!userStats.totalPlayed) {
        return [];
    }
    const games = (await getRankedMatchmakingGames(uid, 0)).response;
    const batchSize = games.length;
    const futures = Array.from(new Array(Math.ceil(userStats.totalPlayed / batchSize) - 1), (x, i) => getRankedMatchmakingGames(uid, batchSize * (i + 1)));
    const futureGames = (await Promise.all(futures)).map(batch => batch.response).flat()
    return games.concat(futureGames);
}
async function processGames(games) {
    var stats = new Stats();
    const futures = games.map(game => async function() {
        await stats.processGame(game);
        $("#loading-progress").val($("#loading-progress").val() + 1);
    }());
    console.log(futures);
    await Promise.all(futures);
    await stats.getPlayerData();
    console.log(stats);
    console.log(stats.ppGames[0].opponents[0].elo(16));
    return stats;
}
function *deduplicateLobbies(games){
    var lobbyIds = new Set();
    
    for(const g of games){
        if(!lobbyIds.has(g.lobbyId)){
            lobbyIds.add(g.lobbyId);
            yield g;
        }
    }
}
$("#stats").tabs();
$("#loading-data").hide();
getAllMatchmakingGames(userUid).then(async (g) => {
    $("#loading-data").show();
    $("#loading img").hide();
    $("#loading-flavor").text("Processing games...");
    $("#loading-progress").attr("max", g.length);
    const stats = await processGames([...deduplicateLobbies(g)]);
    await stats.show();
    $("#loading").hide();
});
