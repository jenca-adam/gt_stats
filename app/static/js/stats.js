function getTileLayer(){
    return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19,
});
}
const TIER_TEXTS = ["Bronze Bird", "Silver Swan", "Gold Goose", "Platin Penguin", "Diamond Duck", "Master Mallard"];
const USER_DATA_CACHE = {};
const PLAYER_CACHE = {};
const HEATMAP_OPTS = {
    blur:0,
    minOpacity:0.5,
    radius:10
};
const gameTemplate = document.querySelector("#game-template");
const playerTemplate = document.querySelector("#player-template");
const guessTemplate = document.querySelector("#guess-template");
const countryCorrectTemplate = document.querySelector("#country-correct-template");
const countryScoreTemplate = document.querySelector("#country-score-template");

const countryTimeTemplate = document.querySelector("#country-time-template");
const map  = L.map('pp-areas-map').fitWorld();;
const tileLayer = getTileLayer().addTo(map);
var densityLayer;
var stats;
var maps=[];
const gtIcon = L.Icon.extend({
    options: {
        iconSize:     [28, 40],
        iconAnchor:   [14, 40],
    }
});
const targetIcon = new gtIcon({iconUrl:"https://static.geo.edutastic.de/app_assets/target-marker.png"});
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
class CountryStats{
    constructor(iso2){
        this.iso2=iso2;
        this.guessedRight=0;
        this.guessedTotal=0;
        this.totalScore=0;
        this.totalTime=0;
        this.mistakes={};
    }
    process(result){
        if(result.pick.lat==0&&result.pick.lng==0){
            return;
        }
        this.guessedTotal++;
        if(result.gotCountry){
            this.guessedRight++;
        }
        else{
            this.mistakes[result.pick.iso2]=(this.mistakes[result.pick.iso2]||0)+1;
        }
        this.totalScore+=result.score;
        this.totalTime+=result.time;
    }

    get averageScore(){
        return this.totalScore/this.guessedTotal;
    }
    get correctRate(){
        return this.guessedRight/this.guessedTotal;
    }
    get averageTime(){
        return this.totalTime/this.guessedTotal;
    }
    get correctHtml(){
        const node = countryCorrectTemplate.content.cloneNode(true);
        $(node).find(".country-correct-name").text(COUNTRIES[this.iso2.toUpperCase()]||this.iso2);
        $(node).find(".country-correct-img").attr("src",`/static/flags/svg/${this.iso2}.svg`);
        $(node).find(".country-correct-percent").text(`${(this.correctRate*100).toFixed(2)}`);
        const sortedMistakes = Object.keys(this.mistakes).sort((a,b)=>this.mistakes[b]-this.mistakes[a]);
        for (const m of sortedMistakes){
            let flagSrc=`/static/flags/svg/${m||'none'}.svg`;
            //let countryName = COUNTRIES[m.toUpperCase()]||m;
            $(node).find(".country-correct-mistakes").append(`<div class="mistake row"><img class="small-flag" src="${flagSrc}">${m||'??'}(${this.mistakes[m]}x)</div>`)
        }
        return node;
    }
    get scoreHtml(){
        const node = countryScoreTemplate.content.cloneNode(true);
        $(node).find(".country-score-name").text(COUNTRIES[this.iso2.toUpperCase()]||this.iso2);
        $(node).find(".country-score-img").attr("src",`/static/flags/svg/${this.iso2}.svg`);
        $(node).find(".country-score-score").text(this.averageScore.toFixed(2));
        return node;
    }
    get timeHtml(){
        const node = countryTimeTemplate.content.cloneNode(true);
        $(node).find(".country-time-name").text(COUNTRIES[this.iso2.toUpperCase()]||this.iso2);
        $(node).find(".country-time-img").attr("src",`/static/flags/svg/${this.iso2}.svg`);
        $(node).find(".country-time-time").text(this.averageTime.toFixed(2));
        return node;
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
    get html(){
        const node = guessTemplate.content.cloneNode(true);
        $(node).find(".guess-score").text(this.score);
        $(node).find(".guess-time").text(`${this.time}s`);
        $(node).find(".guess-distance").text(`${this.distance.toFixed(2)} km`);
        $(node).find(".guess-open").attr('href', this.drop.panoId?`https://www.google.com/maps/@?api=1&map_action=pano&pano=${this.drop.panoId}`:`https://www.google.com/maps/search/?api=1&query=${this.pick.lat},${this.pick.lng}`);
        return node;
    }
    addMap(node){
        const guessMap = L.map($(node).find(".guess-map")[0]);
        guessMap.invalidateSize();
        getTileLayer().addTo(guessMap);
        const guessMarker = L.marker([this.pick.lat, this.pick.lng]).addTo(guessMap);
        var dropMarker = guessMarker;
        
        if(this.drop.lat){
        dropMarker = L.marker([this.drop.lat, this.drop.lng], {icon:targetIcon}).addTo(guessMap);
        L.polyline([[this.pick.lat, this.pick.lng], [this.drop.lat, this.drop.lng]]).addTo(guessMap);
        }
        guessMap.fitBounds(new L.featureGroup([guessMarker, dropMarker]).getBounds());
        maps.push(guessMap);
    }

};

class Player{
    constructor(uid, id, nick){
        this.uid = uid;
        this.id = id;
        this.nick = nick || "???";
        this._userData = null;
        this._ppGames = null;
        this._flagsGames = null;
    }
    get userData() {
            return this._userData || (this._userData = USER_DATA_CACHE[this.uid]);
        }
    elo(mmid){

            return !!this.userData?this.userData.seasonProgress.elo.filter(a => a.matchmakingId === mmid)[0].elo:0;
        }
    get ppGames(){
        return this._ppGames|| (this._ppGames=stats.ppGames.filter(g=>g.opponents[0].player==this));
    }
    get flagsGames(){
        return this._flagsGames || (this._flagsGames=stats.flagsGames.filter(g=>g.opponents[0].player==this));
    }
    get flagsWinRate(){
        return this.flagsGames.filter(g=>g.players[userUid].won).length/this.flagsGames.length;
    }
    get ppWinRate(){
        return this.ppGames.filter(g=>g.players[userUid].won).length/this.ppGames.length;
    }

    get ppHtml() {
         const node = playerTemplate.content.cloneNode(true);
         $(node).find(".player-nick").text(this.nick);
         $(node).find(".player-nick").attr("href", `https://geotastic.net/user-page/${this.uid}`);
        $(node).find(".player-avatar").attr("src", getAvatarUrl(this.userData?.avatarImage));
        $(node).find(".player-rank").html(Rank.fromElo(this.elo(16)).html);
        $(node).find(".player-winrate").text(`${(this.ppWinRate*100).toFixed(2)}%`);
        $(node).find(".player-games-played").text(this.ppGames.length);
        return node;
    }
    get flagsHtml(){
        const node = playerTemplate.content.cloneNode(true);
        $(node).find(".player-nick").text(this.nick);
         $(node).find(".player-nick").attr("href", `https://geotastic.net/user-page/${this.uid}`);
        $(node).find(".player-avatar").attr("src", getAvatarUrl(this.userData?.avatarImage));
        $(node).find(".player-rank").html(Rank.fromElo(this.elo(15)).html);
        $(node).find(".player-winrate").text(`${(this.flagsWinRate*100).toFixed(2)}%`);
        $(node).find(".player-games-played").text(this.flagsGames.length);
        return node;

    }

    games(mmid){
        return mmid==16?this.ppGames:this.flagsGames;
    }
    winRate(mmid){
        return mmid==16?this.ppWinRate:this.flagsWinRate;
    }
    html(mmid){
        return mmid==16?this.ppHtml:this.flagsHtml;
    }
}
class Game {
    static PlayerResult = class PlayerResult {
        // the playerresult class is local to each game to avoid confusion with the Player class
         constructor(player, won) {
            this.results = {};
            this.totalScore = 0;
            this.roundsGuessed = 0;
            this.totalTime = 0;
            this.won = won;
            this.hgram = {};
            this.guessLocations = [];
            this.player = player;
            
        }
        processResult(result) {
            this.results[result.round] = new Result(result);
            if (result.pick.lat==0&&result.pick.lng==0) {
                //don't count forgetting to guess as an actual guess
                return;
            }
            
            this.totalScore += result.score;
            this.totalTime += result.time;
            const bucket = Math.min(23, Math.floor(result.score/250)); // we don't want 6000-ers to be in a separate bucket
            this.hgram[bucket] = (this.hgram[bucket]||0)+1;
            this.guessLocations.push([result.pick.lat, result.pick.lng]);
            this.roundsGuessed++;
        }
        get userData() {
            return this.player.userData;
        }
        get averageScore(){
            return this.totalScore/this.roundsGuessed;
        }
        get averageTime(){
            return this.totalTime/this.roundsGuessed;
        }
        elo(mmid){
            return this.player.elo(mmid);
        }
    };

    constructor(apiResponse) {
        this.players = {};
        this.lobbyId = apiResponse.lobbyId;
        this.matchmakingId = apiResponse.matchmakingId;
        for (const result of apiResponse.results) {
            if (!(result.userUid in this.players)) {
                const p = PLAYER_CACHE[result.userUid] = (PLAYER_CACHE[result.userUid] || new Player(result.userUid, result.userId, result.nickname));
                this.players[result.userUid] = new Game.PlayerResult(p, result.userId==apiResponse.winnerUserId);
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
        $(node).find(".game-opponent").text(this.opponents[0].player.nick);
        $(node).find(".game-opponent").attr("href",`https://geotastic.net/user-page/${this.opponents[0].player.uid}`);
        $(node).find(".game-opponent-rank").html(Rank.fromElo(this.opponents[0].elo(this.matchmakingId)).html);
        $(node).find(".game-score").text(this.players[userUid].averageScore.toFixed(2));
        $(node).find(".game-view").attr("href", `https://geotastic.net/game-history-details/${this.lobbyId}`);
        $(node).find(".game-opponent-avatar").attr("src", getAvatarUrl(this.opponents[0].userData?.avatarImage));
        return node;
    }
    static async fromLobbyId(lobbyId) {
        return new Game((await getGameHistoryDetails(lobbyId)).response);
    }

};
class Stats {
    constructor() {
        this.ppCountryStats = {};
        this.flagsCountryStats = {};
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
        function score(g){
            return g.players[userUid].averageScore*10000+g.players[userUid].averageTime;
        }
        return (mmid==15?this.flagsGames:this.ppGames).sort((a,b)=>(score(b)-score(a)));    
    }
    bestWins(mmid){
        return (mmid==15?this.flagsGames:this.ppGames).filter(g=>(g.players[userUid].won)).sort((a,b)=>(b.opponents[0].elo(mmid)-a.opponents[0].elo(mmid)));
    }
    worstLosses(mmid){
        return (mmid==15?this.flagsGames:this.ppGames).filter(g=>(!g.players[userUid].won)).sort((a,b)=>(a.opponents[0].elo(mmid)-b.opponents[0].elo(mmid)));
    }
    bestOpponents(mmid){
        function score(p,s){
            return p.winRate(mmid)*(s.ppGames.length+s.flagsGames.length)+
            p.games(mmid).length//tiebreaker
        }
        return Object.values(PLAYER_CACHE).
            filter(p=>!!p.games(mmid).length). // has any games played
            sort((a,b)=>score(b,this)-score(a,this));
    }
    worstCountriesCorrect(mmid){
        return Object.values(mmid==15?this.flagsCountryStats:this.ppCountryStats).filter(c=>!!c.guessedTotal).sort((a,b)=>a.correctRate-b.correctRate);
    }
    worstCountriesScore(mmid){
        return Object.values(mmid==15?this.flagsCountryStats:this.ppCountryStats).filter(c=>!!c.guessedTotal).sort((a,b)=>a.averageScore-b.averageScore);
    }
    worstCountriesTime(mmid){
        return Object.values(mmid==15?this.flagsCountryStats:this.ppCountryStats).filter(c=>!!c.guessedTotal).sort((a,b)=>b.averageTime-a.averageTime);
    }

    worstOpponents(mmid){
        function score(p,s){
            return p.winRate(mmid)*(s.ppGames.length+s.flagsGames.length)-
            p.games(mmid).length//tiebreaker (reverse because we want SMALLER scores first)
        }
        return Object.values(PLAYER_CACHE).
            filter(p=>!!p.games(mmid).length). // has any games played
            sort((a,b)=>score(a,this)-score(b,this));
    }
    bestGuesses(mmid){
        function score(g){
            return g.score*1000000-g.distance*(10000*(mmid!=15))-g.time;
        }
        const games = (mmid==15?this.flagsGames:this.ppGames);
        return games.map(g=>Object.values(g.players[userUid].results)).flat().filter(r=>!!r.pick.iso2).sort((a,b)=>(score(b)-score(a)));
    }
    mostPlayedOpponents(mmid){
        return Object.values(PLAYER_CACHE).filter(p=>!!p.games(mmid).length).sort((a,b)=>b.games(mmid).length-a.games(mmid).length);
    }
    async processGame(game) {
        let gameObj = await Game.fromLobbyId(game.lobbyId);
        var countryStats;
        if (game.matchmakingId == 16) {

            this.ppGames.push(gameObj);
            if (game.placement == 1) {
                this.ppWon++;
            }
            countryStats = this.ppCountryStats;

        } else if (game.matchmakingId == 15) {
            this.flagsGames.push(gameObj);
            if (game.placement == 1) {
                this.flagsWon++;
            }
            countryStats = this.flagsCountryStats;
        }
        else{
            return;
        }
        for (const result of Object.values(gameObj.players[userUid].results)){
            if(!result.drop.iso2) continue;
            if(result.drop.iso2 && !countryStats[result.drop.iso2]){
                countryStats[result.drop.iso2] = new CountryStats(result.drop.iso2);
            }
            countryStats[result.drop.iso2].process(result);
        }
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
        for(const g of this.bestWins(16).slice(0,3)){
            $("#pp-games-best-wins").append(g.html);
        }
        for(const g of this.worstLosses(16).slice(0,3)){
            $("#pp-games-worst-losses").append(g.html);
        }
        for(const p of this.bestOpponents(16).slice(0,3)){
            $("#pp-opponents-best").append(p.html(16));
        }
        for(const p of this.worstOpponents(16).slice(0,3)){
            $("#pp-opponents-worst").append(p.html(16));
        }
        for(const p of this.mostPlayedOpponents(16).slice(0,3)){
            $("#pp-opponents-most-played").append(p.html(16));
        }
        const bestPpGuesses = this.bestGuesses(16);
        for (const g of bestPpGuesses.slice(0,3)){
            let node = g.html;
            $("#pp-guesses-best").append(node);
            g.addMap($("#pp-guesses-best .guess").last());
            //setTimeout(()=>{g.addMap(node)}, 10);
        }
        for (const g of bestPpGuesses.slice(bestPpGuesses.length-3).reverse()){
            let node = g.html;
            $("#pp-guesses-worst").append(node);

            g.addMap($("#pp-guesses-worst .guess").last());
            //setTimeout(()=>{g.addMap(node)}, 10);
        }
        for (const c of this.worstCountriesCorrect(16)){
            $("#pp-countries-correct").append(c.correctHtml);
        }
        for (const c of this.worstCountriesScore(16)){
            $("#pp-countries-score").append(c.scoreHtml);
        }
        const hg = $("#pp-dist-histogram")[0];
        Plotly.newPlot('pp-dist-histogram', [{x:[...Array(24).keys().map(k=>k*250)], y:this.ppHistogram, type:"bar"}], {responsive: true});
        const ro = new ResizeObserver(() => {
          Plotly.Plots.resize(hg);
        });

        ro.observe(hg);
        densityLayer=L.heatLayer(this.guessLocations, HEATMAP_OPTS).addTo(map);

    }
    async showFlags() {
        $("#flags-overview-games-played").text(this.flagsGames.length);
        $("#flags-overview-win-rate").text((this.flagsGames.length ? (100 * this.flagsWon / this.flagsGames.length).toFixed(2) : 0) + "%");
        $("#flags-overview-elo").text(this.flagsElo);
        $("#flags-overview-rank").html(this.flagsRank.html);
        const b = this.bestGames(15);
        for(const g of b.slice(0,3)){
            $("#flags-games-best-games").append(g.html);
        }
        for(const g of b.slice(b.length-3).reverse()){
            $("#flags-games-worst-games").append(g.html);
        }
        for (const g of this.bestWins(15).slice(0,3)){
            $("#flags-games-best-wins").append(g.html);
        }
        for (const g of this.worstLosses(15).slice(0,3)){
            $("#flags-games-worst-losses").append(g.html);
        }
        for(const p of this.bestOpponents(15).slice(0,3)){
            $("#flags-opponents-best").append(p.html(15));
        }
        for(const p of this.worstOpponents(15).slice(0,3)){
            $("#flags-opponents-worst").append(p.html(15));
        }
        for(const p of this.mostPlayedOpponents(15).slice(0,3)){
            $("#flags-opponents-most-played").append(p.html(15));
        }
        const bestFlagsGuesses = this.bestGuesses(15);
        for (const g of bestFlagsGuesses.slice(0,3)){
            let node = g.html;
            $("#flags-guesses-best").append(node);
            g.addMap($("#flags-guesses-best .guess").last());
            //setTimeout(()=>{g.addMap(node)}, 10);
        }
        for (const g of bestFlagsGuesses.slice(bestFlagsGuesses.length-3).reverse()){
            let node = g.html;
            $("#flags-guesses-worst").append(node);

            g.addMap($("#flags-guesses-worst .guess").last());
            //setTimeout(()=>{g.addMap(node)}, 10);
        }
        for (const c of this.worstCountriesScore(15)){
            $("#flags-countries-score").append(c.scoreHtml);
        }
        for (const c of this.worstCountriesTime(15)){
            $("#flags-countries-time").append(c.timeHtml);
        }

         const hg = $("#flags-dist-histogram")[0];
        Plotly.newPlot('flags-dist-histogram', [{x:[...Array(24).keys().map(k=>k*250)], y:this.flagsHistogram, type:"bar"}], {responsive: true});
        const ro = new ResizeObserver(() => {
          Plotly.Plots.resize(hg);
        });

        ro.observe(hg);
    }
    async show() {
        await Promise.all([this.showPp(), this.showFlags()]);
    }
    get ppHistogram(){
        const hgram = this.ppGames.map(g=>g.players[userUid].hgram).reduce(sumHgrams, {});
        return [...Array(24).keys().map(bucket=>hgram[bucket]||0)];
    }
    get flagsHistogram(){
        const hgram = this.flagsGames.map(g=>g.players[userUid].hgram).reduce(sumHgrams, {});
        return [...Array(24).keys().map(bucket=>hgram[bucket]||0)];
    }
    get guessLocations(){
        return this.ppGames.map(g=>g.players[userUid].guessLocations).flat();
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
    stats = new Stats();
    const futures = games.map(game => async function() {
        await stats.processGame(game);
        $("#loading-progress").val($("#loading-progress").val() + 1);
    }());
    await Promise.all(futures);
    await stats.getPlayerData();
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
$("#pp-countries > .tabs").tabs();

$("#flags-countries > .tabs").tabs();
$("#loading-data").hide();

getAllMatchmakingGames(userUid).then(async (g) => {
    $("#loading-data").show();
    $("#loading img").hide();
    $("#loading-flavor").text("Processing games...");
    $("#loading-progress").attr("max", g.length);
    const stats = await processGames([...deduplicateLobbies(g)]);
    await stats.show();
    $("#stats").tabs();
    $("#loading").hide();
});
