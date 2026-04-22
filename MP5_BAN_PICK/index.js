// connecting to websocket
import {
    deleteBeatmapSelectionById,
    getAllRound,
    getBeatmapListByRoundName,
    getStoredBeatmapById,
    getStructuredBeatmapsByRound,
    getFullBeatmapFromBracketById,
    getIsMatchStageAdvancing,
    getModNameAndIndexById,
    getStoredBeatmap,
    setIsMatchStageAdvancing,
    storeBeatmapSelection,
    clearBeatmapSelections,
} from "../COMMON/lib/bracket.js";

import { ChatRenderer } from "../COMMON/components/ChatRenderer.js";
import WebSocketManager from "../COMMON/lib/socket.js";
import { drawTeamAndPlayerInfo } from "./teamAndPlayer.js";
// import MatchStages from "../COMMON/data/matchstages.json" with { type: "json" };
const MatchStages = await fetch('../COMMON/data/matchstages.json').then(res => res.json());
import { getMatchStats, getMatchStatsById, setMatchStats, clearMatchStats, removeMatchStatsById } from "../COMMON/lib/mapStats.js";
import { BPOrderStore } from "./BPOrderStore.js";

console.log(MatchStages);

const socket = new WebSocketManager(`${window.location.hostname}:24050`);
const BPOrderStoreInst = new BPOrderStore({
    btnFirstBanRed: document.getElementById('button-first-ban-red'),
    btnFirstBanBlue: document.getElementById('button-first-ban-blue'),
    btnFirstPickRed: document.getElementById('button-first-pick-red'),
    btnFirstPickBlue: document.getElementById('button-first-pick-blue'),
    imgBPOrderRed: document.getElementById('team-a-bp-order'),
    imgBPOrderBlue: document.getElementById('team-b-bp-order'),
    labelFirstBan: document.getElementById('label-first-ban'),
});
const ChatRendererInst = new ChatRenderer({
    chatContainer: document.getElementById("chat-content"),
});

const TEAM_RED = "Red";
const TEAM_BLUE = "Blue";

const cache = {
    leftTeam: "",
    rightTeam: "",
    chat: [],
    md5: "",
    // auto BP only works for first beatmap change (or manual pick) after streamer manually chooses pick/ban side.
    // [TODO] detect OBS scene change for fully automatic B/P
    canAutoPick: false,
    // mapChoosed 存储 canAutoPick 为假后谱面是否变动
    // [TODO] 改成某种方法判断是否已经切出过 BAN_PICK 场景, 这样就不用存这两个状态了
    lastChangedMapBid: null,

    // list of BIDs of picked/banned maps
    pickedMaps: [],
    mapWinners: {},

    // 存储当前比赛阶段
    currentMatchStageIndex: -1,
    currentMatchStage: null,
    currentOperationTeam: null,
    switchSidesInterval: null,

    leftStars: 0,
    rightStars: 0,
};

let currentOperation = null;
let isAutoPick = true;

// [TODO] OBS-based automatic pick/ban rotating
/*
// obs-browser feature checks
if (window.obsstudio) {
    console.log('OBS Browser Source detected, version:', window.obsstudio.pluginVersion);
    console.log('Feature checks..');
    window.obsstudio.getControlLevel(function (level) {
        console.log(`OBS browser control level: ${level}`);

        if (level < 1) {
            // READ_OBS not available
            console.log('READ_OBS not available');
        } else {

        }
    });
} else {
    console.warn('Not OBS Browser or OBS control features not supported, auto pick/ban would be disabled');
    isAutoPick = false;
    toggleEnableAutoPick(isAutoPick);
    document.getElementById("button-auto-picks").style.display = "none";
}
*/

/**
 * 判断是否打完一张图, 打完了则轮换操作方
 * 虽然用在 setInterval 里, 但实际上每次操作都会重置, 不用担心读到错误的全局状态变量
 */
function tryAdvanceMatchStage() {
    if (getIsMatchStageAdvancing()) {
        setIsMatchStageAdvancing(0);
        currentOperation = {
            team: cache.currentOperationTeam,
            type: cache.currentMatchStage.type,
        }
        console.log('轮换操作方, 当前操作: ' + currentOperation.team + ' ' + currentOperation.type);
        clearInterval(cache.switchSidesInterval);
        cache.switchSidesInterval = null;
        updateOperationDisplay();
        toggleAllowAutoPick(true);
        tryAutoPick();
    }
}

/**
 * 处理撤销操作时的 match stage 变动
 */
function handleMatchStageUndone() {
    cache.currentMatchStageIndex = Math.max(0, cache.currentMatchStageIndex - 1);
    cache.currentMatchStage = MatchStages[cache.currentMatchStageIndex];
    cache.currentOperationTeam = BPOrderStoreInst.resolveMatchStageTeam(cache.currentMatchStage.team);
    console.log('撤销操作, 当前比赛阶段: ' + cache.currentMatchStageIndex);
    clearInterval(cache.switchSidesInterval);
    setIsMatchStageAdvancing(1);
    tryAdvanceMatchStage();
}

const usesCDPickOrder = MatchStages.some(s => s.team === 'C' || s.team === 'D');

/**
 * 根据 matchstages.json 处理比赛阶段, 设置操作方, 设置 currentOperation 并处理选图方自动轮换
 */
function handleMatchStageChange() {
    // 使用选过的图的数量作为当前比赛阶段，避免额外存状态变量
    cache.currentMatchStageIndex = cache.pickedMaps.length;
    if (cache.currentMatchStageIndex <= 0) {
        console.warn('是否已经清空所有操作？');
        return;
    }

    cache.currentMatchStage = MatchStages[cache.currentMatchStageIndex];
    if (!cache.currentMatchStage) {
        console.error("Invalid match stage");
        return;
    }

    /*
    // lock first ban from first completed Ban operation
    if (!BPOrderStoreInst.getFirstBanTeam() && currentOperation?.type === 'Ban') {
        BPOrderStoreInst.setFirstBanTeam(currentOperation.team);
    }

    // for C/D mode, lock first pick from first completed Pick operation
    if (usesCDPickOrder && !BPOrderStoreInst.getFirstPickTeam() && currentOperation?.type === 'Pick') {
        BPOrderStoreInst.setFirstPickTeam(currentOperation.team);
    }
    */

    if (currentOperation?.type === 'Ban' || currentOperation?.type === 'Blank') {
        setIsMatchStageAdvancing(1);
    }

    cache.currentOperationTeam = BPOrderStoreInst.resolveMatchStageTeam(cache.currentMatchStage.team);
    if (!cache.currentOperationTeam) {
        console.warn('当前阶段操作方未确定，请先设置先Ban/先Pick队伍');
        toggleAllowAutoPick(false);
        return;
    }
    // 处理当前比赛阶段
    console.log("当前比赛阶段: " + cache.currentMatchStageIndex);
    switch (cache.currentMatchStage.type) {
        case "Pick":
            console.log("当前比赛阶段: 选图");
            console.log("当前操作方: " + cache.currentOperationTeam);
            break;
        case "Ban":
            console.log("当前比赛阶段: 禁图");
            console.log("当前操作方: " + cache.currentOperationTeam);
            break;
        default:
            console.error("未知比赛阶段");
    }

    clearInterval(cache.switchSidesInterval);
    cache.switchSidesInterval = setInterval(tryAdvanceMatchStage, 200);
    tryAdvanceMatchStage();
}

function toggleAllowAutoPick(isAllow) {
    console.log('允许自动 BP: ' + isAllow);
    cache.canAutoPick = isAllow;
}

socket.api_v1(async ({ menu, tourney }) => {
    try {
        // 聊天
        const chat = tourney.manager.chat;
        if (chat.length !== cache.chat.length) {
            cache.chat = chat;
            ChatRendererInst.renderChatMessages(chat);
        }
        if (cache.leftTeam != tourney.manager?.teamName.left || cache.rightTeam != tourney.manager?.teamName.right) {
            ChatRendererInst.updateTeams({
                left: tourney.manager.teamName.left,
                right: tourney.manager.teamName.right,
            });
        }

        drawTeamAndPlayerInfo(tourney, cache);

        // watch for map change
        if (menu.bm.md5 !== cache.md5) {
            cache.md5 = menu.bm.md5;
            cache.lastChangedMapBid = parseInt(menu.bm.id);
            console.log('当前播放谱面变动, 新 BID: ' + cache.lastChangedMapBid);

            if (!isAutoPick);
            else if (!cache.canAutoPick);
            else {
                // auto pick is possible, and map changed
                doAutoPick(currentOperation.team == 'Red' ? TEAM_RED : TEAM_BLUE, menu.bm.id, currentOperation.type.toLowerCase());
            }
        }

        if (tourney.manager.stars.left != cache.leftStars) {
            onStarChanged(TEAM_RED, cache.leftStars, tourney.manager.stars.left);
            cache.leftStars = tourney.manager.stars.left;
        }
        if (tourney.manager.stars.right != cache.rightStars) {
            onStarChanged(TEAM_BLUE, cache.rightStars, tourney.manager.stars.right);
            cache.rightStars = tourney.manager.stars.right;
        }
    } catch (error) {
        console.log(error);
    }
});

/**
 * 进行一次自动 BP 操作, 将允许自动 BP 状态设置为 false
 * @param {Number} team 操作的目标队伍 TEAM_RED or TEAM_BLUE
 * @param {Number} bid 操作的目标谱面 BID
 * @param {String} type 操作类型 "pick" or "ban"
 * @returns {Promise<void>}
 */
async function doAutoPick(team, bid, type) {
    console.log(bid)
    if (typeof bid !== "number") {
        bid = parseInt(bid, 10);
    }
    const [beatmap, mods] = await Promise.all([
        getFullBeatmapFromBracketById(bid),
        getModNameAndIndexById(bid),
    ]);

    // MP5 referee convention: keep TB picked ingame before the first real pick
    if (mods.modName === "TB") return;

    // Check if map was picked
    let isMapPicked = false;
    cache.pickedMaps.forEach(pickedBID => { isMapPicked |= bid.toString() == pickedBID });

    if (!isMapPicked) {
        console.log(beatmap);
        applyOperationToDOM(team, beatmap.ID, type);
        applyOperationStyles(document.getElementById(beatmap.ID), {
            team: team === TEAM_RED ? "Red" : "Blue",
            type: type.charAt(0).toUpperCase() + type.slice(1),
        });
        console.log('自动 BP 操作: ' + beatmap);
        toggleAllowAutoPick(false);
        // ban 操作不需要等打图，直接进入下一阶段
        if (type == 'ban') {
            setIsMatchStageAdvancing(1);
        }
        setTimeout(handleMatchStageChange, 100);
    }
}

/**
 * 将一次选图显示到 UI 上，并保存到 cache.pickedMaps 和 localStorage
 * @param {Number} team constant TEAM_RED or TEAM_BLUE
 * @param {Number|String} bid BID of said map
 * @param {String} type "pick", "ban" or "blank", lowercase
 * @param {Boolean} animate apply highlighting animation to the element, defaults to true
 * @returns the DOM element of the new operation
 */
async function applyOperationToDOM(team, bid, type, animate = true) {

    // 检查图是否已经选过
    if (!cache.pickedMaps.includes(bid.toString())) {


        let operationContainer = team === TEAM_RED ?
            document.getElementById("team-a-operation") :
            document.getElementById("team-b-operation");
        let operation = document.createElement("div");
        let beatmap = await getFullBeatmapFromBracketById(bid);
        let mods = await getModNameAndIndexById(bid);

        if (type === "blank") {
            operation.id = team === TEAM_RED ? "team-a-blank" : "team-b-blank";
            animate && operation.classList.add('animated');
            operationContainer.appendChild(operation);
            return operation;
        }

        operation.id = bid.toString();

        cache.pickedMaps.push(bid.toString());
        if (type === "pick") {
            operation.classList.add(team === TEAM_RED ? "team-a-pick" : "team-b-pick");
        }
        if (type === "ban") {
            operation.classList.add(team === TEAM_RED ? "team-a-ban" : "team-b-ban");
        }
        const classPrefix = team === TEAM_RED ? "team-a" : "team-b"
        // [FIXME] 这里 beatmap.BeatmapInfo.Covers["card@2x"] 可能需要考虑文件名带 # 时的转义问题
        // 暂时还没测试
        // 比较脏的办法是 URL.parse(...) 后取 path 和 hash 手动拼接
        // 拼接后分段做 encodeURIComponent 再拼出完整的 URL
        operation.innerHTML = `  
    <div class="${classPrefix}-map-cover-border map-border-${mods.modName.toLocaleLowerCase()}">                      
        <img class="${classPrefix}-map-cover"
             src="${beatmap.BeatmapInfo.Covers["card@2x"]}">
    </div>
    <div class="${classPrefix}-map-mod-container  map-mod-container-${mods.modName.toLocaleLowerCase()}">
        <span class="${classPrefix}-map-mod">${mods.modName}${mods.index}</span>
    </div>

    <span class="${classPrefix}-map-title">${beatmap.BeatmapInfo.Metadata.title_unicode} [${beatmap.BeatmapInfo.DifficultyName}]</span>
    <span class="${classPrefix}-map-artist"> - ${beatmap.BeatmapInfo.Metadata.artist_unicode}</span>
`;

        storeBeatmapSelection({
            team: team === TEAM_RED ? "Red" : "Blue",
            type: type.charAt(0).toUpperCase() + type.slice(1),
            beatmapId: bid.toString(),
        });
        if (animate) {
            setTimeout(function () {
                operation.classList.add("shown");
            }, 1000);
            operation.classList.add("animated");
        }
        else {
            operation.classList.add("shown");
        }

        operationContainer.appendChild(operation);

        return operation;
    }
    else {
        console.log(`图 ${bid} 已经被选过`);
        return null;
    }
}


function activateButton(buttonId) {
    document
        .getElementById(buttonId)
        .classList.remove("button-inactive", "button-active");
    document.getElementById(buttonId).classList.add("button-active");
}

function deactivateButtons(...buttonIds) {
    buttonIds.forEach((buttonId) => {
        document
            .getElementById(buttonId)
            .classList.remove("button-inactive", "button-active");
        document.getElementById(buttonId).classList.add("button-inactive");
    });
}

document.addEventListener("selectstart", function (e) {
    e.preventDefault();
});

let allRound;
let currentRoundName;
getAllRound().then(
    (rounds) => {
        allRound = rounds;
        // 尝试从localstorage找回当前轮次，仅仅当bracket存在当前轮次名字时才找回
        if (localStorage.getItem('currentRound')
            && rounds.some(round => round.roundName === localStorage.getItem('currentRound'))) {
            currentRoundName = localStorage.getItem('currentRound');
            locked = true;
            deactivateButtons("button-match-next", "button-match-previous")
            document.getElementById("lock").innerText = "解锁";
        } else {
            // 如果localstorage为空，则使用最后一轮
            currentRoundName = rounds[rounds.length - 1].roundName;
        }
        onCurrentRoundChange();
    }
);

/**
 * 选定操作方后假如当前谱面未被 ban/pick, 进行一次自动 BP 操作
 */
function tryAutoPick() {
    if (!isAutoPick) return;
    if (!cache.canAutoPick) return;
    if (cache.lastChangedMapBid === null) return;
    doAutoPick(currentOperation.team == 'Red' ? TEAM_RED : TEAM_BLUE, cache.lastChangedMapBid, currentOperation.type.toLowerCase());
    cache.lastChangedMapBid = null;
}

function updateOperationDisplay() {
    deactivateButtons(
        "button-a-ban",
        "button-a-pick",
        "button-b-ban",
        "button-b-pick",
    );
    switch (currentOperation.team) {
        case "Red":
            // 高亮 team-a
            document.getElementById("team-a").style.backgroundColor = "#824242";
            document.getElementById("team-b").style.backgroundColor = "#202d45";
            if (currentOperation.type === "Pick") {
                activateButton("button-a-pick");
            }
            else if (currentOperation.type === "Ban") {
                activateButton("button-a-ban");
            }
            break;
        case "Blue":
            // 高亮 team-b
            document.getElementById("team-a").style.backgroundColor = "#412121";
            document.getElementById("team-b").style.backgroundColor = "#415a8a";
            if (currentOperation.type === "Pick") {
                activateButton("button-b-pick");
            }
            else if (currentOperation.type === "Ban") {
                activateButton("button-b-ban");
            }
            break;
    }
}

document.getElementById("button-a-ban").addEventListener("click", function () {
    // 准备好全局变量，类似于{ "team": "Red", "type": "Pick", "beatmapID": 2194138 }，只不过没有beatmapId
    currentOperation = {
        team: "Red",
        type: "Ban",
    };
    updateOperationDisplay();

    toggleAllowAutoPick(true);
    tryAutoPick();
});
document
    .getElementById("button-a-pick")
    .addEventListener("click", function () {
        currentOperation = {
            team: "Red",
            type: "Pick",
        };

        updateOperationDisplay();
        toggleAllowAutoPick(true);
        tryAutoPick();
    });

document.getElementById("button-b-ban").addEventListener("click", function () {
    currentOperation = {
        team: "Blue",
        type: "Ban",
    };

    updateOperationDisplay();
    toggleAllowAutoPick(true);
    tryAutoPick();
});
document
    .getElementById("button-b-pick")
    .addEventListener("click", function () {
        currentOperation = {
            team: "Blue",
            type: "Pick",
        };

        updateOperationDisplay();
        toggleAllowAutoPick(true);
        tryAutoPick();
    });
document
    .getElementById("button-a-blank")
    .addEventListener("click", function () {
        // 如果没有ID为team-a-blank的子元素则创建
        if (!document.getElementById("team-a-blank")) {
            this.classList.remove('button-active');
            this.classList.add('button-inactive');

            applyOperationToDOM(TEAM_RED, -1, "blank", true);
            storeBeatmapSelection({
                team: "Red",
                type: "Blank",
                beatmapId: "RED_BLANK",
            });
            currentOperation = {
                team: "Red",
                type: "Blank",
            };
            cache.pickedMaps.push("RED_BLANK");
            handleMatchStageChange();
        }
    });
document
    .getElementById("button-b-blank")
    .addEventListener("click", function () {
        // 如果没有ID为team-b-blank的子元素则创建
        if (!document.getElementById("team-b-blank")) {
            this.classList.remove('button-active');
            this.classList.add('button-inactive');

            applyOperationToDOM(TEAM_BLUE, -1, "blank", true);
            storeBeatmapSelection({
                team: "Blue",
                type: "Blank",
                beatmapId: "BLUE_BLANK",
            });
            currentOperation = {
                team: "Blue",
                type: "Blank",
            };
            cache.pickedMaps.push("BLUE_BLANK");
            handleMatchStageChange();
        }
    });

let clearPickStatus = 0,
    clearPickResetTimer = null;
document
    .getElementById("button-clear-picks")
    .addEventListener("click", function () {
        clearPickStatus += 1;
        switch (clearPickStatus) {
            case 1:
                document.getElementById("button-clear-picks").classList.remove("button-active");
                document.getElementById("button-clear-picks").classList.add("button-warning");
                document.getElementById("button-clear-picks").textContent = "确认清空？";
                clearPickResetTimer = setTimeout(() => { clearPickStatus = 0; document.getElementById("button-clear-picks").textContent = "清空所有BP"; document.getElementById("button-clear-picks").classList.remove("button-warning"); document.getElementById("button-clear-picks").classList.add("button-active"); }, 3000);
                break;
            case 2:
                console.log("清空所有操作");
                clearTimeout(clearPickResetTimer);
                clearPickResetTimer = null;
                deactivateButtons(
                    "button-a-ban",
                    "button-a-pick",
                    "button-b-ban",
                    "button-b-pick",
                );
                deactivateButtons("button-first-ban-red", "button-first-ban-blue", "button-first-pick-red", "button-first-pick-blue");
                BPOrderStoreInst.hardReset();
                document.getElementById("team-a-operation").innerHTML = "";
                document.getElementById("team-b-operation").innerHTML = "";
                document.getElementById("map-pool-mod-container").innerHTML = "";
                clearBeatmapSelections();
                clearMatchStats();
                currentOperation = null;
                onCurrentRoundChange();

                clearPickStatus = 0;
                document.getElementById("button-clear-picks").textContent = "清空所有BP";
                document.getElementById("button-clear-picks").classList.remove("button-warning");
                document.getElementById("button-clear-picks").classList.add("button-active");

                toggleAllowAutoPick(false);
                cache.pickedMaps = [];

                // [TODO] 将空操作按键状态抽象成单一的函数
                document.getElementById('button-a-blank').classList.remove('button-inactive');
                document.getElementById('button-b-blank').classList.remove('button-inactive');
                document.getElementById('button-a-blank').classList.add('button-active');
                document.getElementById('button-b-blank').classList.add('button-active');
        };
    });

document
    .getElementById("button-a-blank")
    .addEventListener("contextmenu", function () {
        let operationContainer = document.getElementById("team-a-operation");
        //删除ID为team-a-blank的子元素
        operationContainer.removeChild(document.getElementById("team-a-blank"));
        // 从localstorage删除操作
        deleteBeatmapSelectionById("RED_BLANK");

        this.classList.remove('button-inactive');
        this.classList.add('button-active');
    });
document
    .getElementById("button-b-blank")
    .addEventListener("contextmenu", function () {
        let operationContainer = document.getElementById("team-b-operation");
        //删除ID为team-b-blank的子元素
        operationContainer.removeChild(document.getElementById("team-b-blank"));
        // 从localstorage删除操作
        deleteBeatmapSelectionById("BLUE_BLANK");

        this.classList.remove('button-inactive');
        this.classList.add('button-active');
    });
document
    .getElementById("button-auto-picks")
    .addEventListener("click", function () {
        isAutoPick = !isAutoPick;
        toggleEnableAutoPick(isAutoPick);
        console.log("自动BP：" + isAutoPick);
    });

function toggleEnableAutoPick(isEnable) {
    if (isEnable) {
        document.getElementById("button-auto-picks").classList.add("button-active");
        document.getElementById("button-auto-picks").classList.remove("button-inactive");
        document.getElementById("button-auto-picks").textContent = "自动BP：启用";
    }
    else {
        document.getElementById("button-auto-picks").classList.add("button-inactive");
        document.getElementById("button-auto-picks").classList.remove("button-active");
        document.getElementById("button-auto-picks").textContent = "自动BP：禁用";
    }
}

/**
 * 轮次切换时触发，从Localstorage找回所有之前的Ban Pick操作，并显示在界面上
 */
function restoreBeatmapSelection() {
    const beatmapSelectionMap = getStoredBeatmap();
    if (beatmapSelectionMap != null) {
        const beatmapSelections = Array.from(beatmapSelectionMap.values());
        const teamAContainer = document.getElementById("team-a-operation");
        const teamBContainer = document.getElementById("team-b-operation");

        if (teamAContainer && teamBContainer) {
            teamAContainer.innerHTML = "";
            teamBContainer.innerHTML = "";

            beatmapSelections.forEach(operation => {
                const { team, type, beatmapId } = operation;

                if (type === 'Blank') {
                    applyOperationToDOM(team, -1, "blank", false);
                    cache.pickedMaps.push(beatmapId);
                    let el = document.getElementById(team === TEAM_RED ? 'button-a-blank' : 'button-b-blank');
                    el.classList.remove('button-active');
                    el.classList.add('button-inactive');
                    return;
                }

                applyOperationToDOM(team, Number(beatmapId), type.toLocaleLowerCase(), false);
            });
        }
    }
}

function onCurrentRoundChange() {
    document.getElementById("current-match").innerText = "当前场次：" + currentRoundName;

    BPOrderStoreInst.reset();
    BPOrderStoreInst.loadFirstBanPickFromStorage();
    updateBPOrderBtnDisplay();

    restoreBeatmapSelection();
    // 根据场次名称找到本场谱面
    getStructuredBeatmapsByRound(currentRoundName).then(async beatmaps => {
        // 填充map-pool-mod-container
        const mapPool = document.getElementById("map-pool-mod-container");
        mapPool.innerHTML = "";

        let currentMod = "";
        let mod;
        let index = 0;

        // 创建一个文档片段
        const fragment = document.createDocumentFragment();

        let flattenedBeatmaps = [];
        for (let i of Object.values(beatmaps)) {
            flattenedBeatmaps = flattenedBeatmaps.concat(i);
        }

        for (let beatmap of flattenedBeatmaps) {
            let { modName, index } = await getModNameAndIndexById(beatmap.ID);
            if (modName !== currentMod) {
                currentMod = modName;
                mod = document.createElement("div");
                mod.className = "map-pool-mod";
                fragment.appendChild(mod);
            }

            const map = document.createElement("button");
            map.className =
                "map-pool-button-base map-pool-button-" +
                currentMod.toLocaleLowerCase();
            map.id = `${beatmap.ID}`;

            // 生成HTML
            map.innerText = currentMod + String(index);
            mod.appendChild(map);

            // 为map元素添加事件监听器
            setupMapListeners(map);

            console.log(`appending map: ${map.id}`);
        };

        // 将文档片段添加到DOM中
        mapPool.appendChild(fragment);

        reloadOperationStyles();
    });

    toggleAllowAutoPick(false);
}

function setupMapListeners(map) {
    const beatmapId = map.id;
    map.addEventListener("click", async () => {
        console.log(beatmapId);
        //beatmapId转数字
        const bid = parseInt(beatmapId, 10);
        // 使用Promise.all处理异步操作
        const beatmap = await getFullBeatmapFromBracketById(bid);

        deactivateButtons(
            "button-a-ban",
            "button-a-pick",
            "button-b-ban",
            "button-b-pick",
        );

        if (currentOperation !== null) {
            currentOperation = {
                ...currentOperation,
                beatmapId: beatmapId,
            };

            applyOperationToDOM(currentOperation.team === "Red" ? TEAM_RED : TEAM_BLUE, beatmap.ID, currentOperation.type.toLocaleLowerCase(), true);
            applyOperationStyles(map, currentOperation);

            if (currentOperation.type === 'Ban' || currentOperation.type === 'Blank') {
                setIsMatchStageAdvancing(1);
            }

            setTimeout(handleMatchStageChange, 100);
        }
    });

    map.addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });
}

/**
 * 将选图情况更新至控制台, [FIXME] 目前的实现很脏而且效率很低
 * @param {Element} map 发起选图的控制台按钮
 * @param {*} operation
 */
function applyOperationStyles(map, operation) {
    if (operation.type === "Blank") {
        return;
    }
    if (!operation) {
        return;
    }
    if (cache.pickedMaps.includes(map.id)) {
        return;
    }
    // 清除所有样式
    map.classList.remove("map-pool-button-a-pick");
    map.classList.remove("map-pool-button-a-ban");
    map.classList.remove("map-pool-button-b-pick");
    map.classList.remove("map-pool-button-b-ban");
    // 添加对应的样式
    if (operation.team === "Red") {
        if (operation.type === "Pick") {
            map.classList.add("map-pool-button-a-pick");
        }
        if (operation.type === "Ban") {
            map.classList.add("map-pool-button-a-ban");
        }
    }
    if (operation.team === "Blue") {
        if (operation.type === "Pick") {
            map.classList.add("map-pool-button-b-pick");
        }
        if (operation.type === "Ban") {
            map.classList.add("map-pool-button-b-ban");
        }
    }
}

/**
 * 从 localStorage 找回所有选图记录并更新到控制台按钮
 */
function reloadOperationStyles() {
    let pickHistory = getStoredBeatmap() || new Map([]);
    console.log(pickHistory);
    Array.from(document.getElementsByClassName("map-pool-mod")).forEach(mod => {
        Array.from(mod.getElementsByClassName("map-pool-button-base")).forEach(m => {
            m.classList.remove("map-pool-button-a-pick");
            m.classList.remove("map-pool-button-a-ban");
            m.classList.remove("map-pool-button-b-pick");
            m.classList.remove("map-pool-button-b-ban");

            if (pickHistory.has(m.id)) {
                let operation = pickHistory.get(m.id);
                console.log(operation);
                if (operation.team === "Red") {
                    if (operation.type === "Pick") {
                        m.classList.add("map-pool-button-a-pick");
                    }
                    if (operation.type === "Ban") {
                        m.classList.add("map-pool-button-a-ban");
                    }
                }
                if (operation.team === "Blue") {
                    if (operation.type === "Pick") {
                        m.classList.add("map-pool-button-b-pick");
                    }
                    if (operation.type === "Ban") {
                        m.classList.add("map-pool-button-b-ban");
                    }
                }
            }
        });
    });
}

function undoBeatmapSelection() {
    let beatmapId = cache.pickedMaps.pop();
    if (beatmapId) {
        console.log("撤销操作: " + beatmapId);
        // 更新上方BanPick容器 删除对当前谱面的操作
        const operationElements = [
            document.getElementById("team-a-operation"),
            document.getElementById("team-b-operation"),
        ];

        operationElements.forEach((element) => {
            element
                .querySelectorAll(`div[id="${beatmapId}"]`)
                .forEach((operation) => {
                    operation.classList.add("fade-out");
                    setTimeout(function () {
                        operation.remove();
                    }, 500);
                });
        });

        // 清理 pickedMaps 中的条目
        cache.pickedMaps = cache.pickedMaps.filter((pickedBID) => pickedBID != beatmapId.toString());

        const map = document.getElementsByClassName('map-pool-button-base').namedItem(beatmapId);
        console.log(map);
        if (!map) {
            console.warn("找不到对应的控制台按钮");
        }
        // 删除控制台里的样式
        map.classList.remove("map-pool-button-a-pick");
        map.classList.remove("map-pool-button-a-ban");
        map.classList.remove("map-pool-button-b-pick");
        map.classList.remove("map-pool-button-b-ban");

        // 从localstorage删除操作
        deleteBeatmapSelectionById(beatmapId);
        removeMatchStatsById(beatmapId);
        handleMatchStageUndone();
    }
}

let locked = false;

document
    .getElementById("button-match-next")
    .addEventListener("click", function () {
        if (locked) {
            return;
        }
        //切换currentRoundName到下一场
        for (let i = 0; i < allRound.length; i++) {
            if (allRound[i].roundName === currentRoundName) {
                console.log(i);
                if (i === allRound.length - 1) {
                    currentRoundName = allRound[0].roundName;
                } else {
                    currentRoundName = allRound[i + 1].roundName;
                }
                break;
            }
        }

        onCurrentRoundChange();
    });

document
    .getElementById("button-match-previous")
    .addEventListener("click", function () {
        if (locked) {
            return;
        }
        //切换currentRound到上一场
        for (let i = 0; i < allRound.length; i++) {
            if (allRound[i].roundName === currentRoundName) {
                if (i === 0) {
                    currentRoundName = allRound[allRound.length - 1].roundName;
                } else {
                    currentRoundName = allRound[i - 1].roundName;
                }
                break;
            }
        }
        onCurrentRoundChange();
    });

document.getElementById("lock").addEventListener("click", function () {
    if (locked) {
        locked = false;
        activateButton("button-match-next");
        activateButton("button-match-previous");
        document.getElementById("lock").innerText = "锁定";
        // 清除localstorage里当前轮次
        localStorage.removeItem("currentRound");
    } else {
        locked = true;
        deactivateButtons("button-match-next", "button-match-previous");
        document.getElementById("lock").innerText = "解锁";
        // 存储当前轮次到localstorage
        localStorage.setItem("currentRound", currentRoundName);
    }
});
document.addEventListener("contextmenu", function (event) {
    event.preventDefault();
});

document.getElementById("button-undo").addEventListener("click", undoBeatmapSelection);

async function updateMapWinners() {
    const stats = getMatchStats();
    if (!stats) return;
    const beatmapSelectionDisplayElements = Array.from(document.querySelectorAll('.team-a-pick, .team-b-pick'));

    Object.values(beatmapSelectionDisplayElements).forEach((el) => {
        const bid = el.id;
        const mapStats = stats[bid];
        el.classList.remove('grow-left', 'grow-right', 'grow-winner-red', 'grow-winner-blue');
        let winnerDisplayClass = mapStats?.winner === TEAM_RED ? "grow-winner-red" : mapStats?.winner === TEAM_BLUE ? "grow-winner-blue" : "";
        if (!winnerDisplayClass) return;
        el.classList.add(winnerDisplayClass);
        if (el.classList.contains('team-a-pick')) {
            el.classList.add('grow-right');
        }
        else if (el.classList.contains('team-b-pick')) {
            el.classList.add('grow-left');
        }
    });
}

function getReqParam(param) {
    let url = new URL(window.location.href);
    return url.searchParams.get(param);
}

const debug = getReqParam('debug') === 'true' || false;

if (debug) {
    drawTeamAndPlayerInfo({
        manager: {
            teamName: {
                left: 'liliaceae213',
                right: '22S 5dW'
            }
        }
    }, {
        leftTeam: '',
        rightTeam: '',
    })

    setInterval(() => {
        let stats = getMatchStatsById('4274105');
        stats = stats || {};
        if (stats?.winner) {
            stats.winner = null;
        }
        else {
            stats.winner = TEAM_RED;
        }
        setMatchStats('4274105', stats);
    }, 1000);
    setMatchStats('5015923', { winner: TEAM_BLUE });
    setMatchStats('4686313', { winner: TEAM_BLUE });
}

const updateMapWinnersInterval = setInterval(updateMapWinners, 200);
updateMapWinners();

function onStarChanged(team, oldStar, newStar) {
    const starDiff = newStar - oldStar;
    let currentStars = cache.leftStars + cache.rightStars;
    const operations = getStoredBeatmap();
    const pickOperations = Array.from(operations.values()).filter(op => op.type === 'Pick');

    if (starDiff === 1) {
        let stats = getMatchStatsById(pickOperations[currentStars]?.beatmapId);
        stats = stats || {};
        stats.winner = team;
        setMatchStats(pickOperations[currentStars]?.beatmapId, stats);
    }
    else if (starDiff === -1) {
        for (let i = currentStars - 1; i < pickOperations.length; i++) {
            let stats = getMatchStatsById(pickOperations[i]?.beatmapId);
            if (stats?.winner) {
                delete stats.winner;
                setMatchStats(pickOperations[i]?.beatmapId, stats);
                break;
            }
        }
    }
}

function onBPOrderBtnClick(ev) {
    if (ev.target.id === 'button-first-ban-red') {
        BPOrderStoreInst.setFirstBanTeam('Red');
    }
    else if (ev.target.id === 'button-first-ban-blue') {
        BPOrderStoreInst.setFirstBanTeam('Blue');
    }
    else if (ev.target.id === 'button-first-pick-red') {
        BPOrderStoreInst.setFirstPickTeam('Red');
    }
    else if (ev.target.id === 'button-first-pick-blue') {
        BPOrderStoreInst.setFirstPickTeam('Blue');
    }

    updateBPOrderBtnDisplay();
}

function updateBPOrderBtnDisplay() {
    const firstBanTeam = BPOrderStoreInst.getFirstBanTeam();
    const firstPickTeam = BPOrderStoreInst.getFirstPickTeam();

    if (firstBanTeam === 'Red') {
        activateButton('button-first-ban-red');
        deactivateButtons('button-first-ban-blue');
    }
    else if (firstBanTeam === 'Blue') {
        activateButton('button-first-ban-blue');
        deactivateButtons('button-first-ban-red');
    }

    if (firstPickTeam === 'Red') {
        activateButton('button-first-pick-red');
        deactivateButtons('button-first-pick-blue');
    }
    else if (firstPickTeam === 'Blue') {
        activateButton('button-first-pick-blue');
        deactivateButtons('button-first-pick-red');
    }
}

// [TODO] 在双方队旗边上显示先 ban / 先 pick
function onBPOrderChanged(firstBanTeam) {
}

BPOrderStoreInst.onFirstBanUpdate(onBPOrderChanged);

document.getElementById('button-first-ban-red').addEventListener('click', onBPOrderBtnClick);
document.getElementById('button-first-ban-blue').addEventListener('click', onBPOrderBtnClick);
document.getElementById('button-first-pick-red').addEventListener('click', onBPOrderBtnClick);
document.getElementById('button-first-pick-blue').addEventListener('click', onBPOrderBtnClick);
