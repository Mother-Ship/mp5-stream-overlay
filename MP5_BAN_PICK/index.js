// connecting to websocket
import {
    deleteBeatmapSelectionById,
    getAllRound,
    getBeatmapListByRoundName,
    getFullBeatmapFromBracketById,
    getIsMatchStageAdvancing,
    getModNameAndIndexById,
    getStoredBeatmap,
    setIsMatchStageAdvancing,
    storeBeatmapSelection,
} from "../COMMON/lib/bracket.js";

import WebSocketManager from "../COMMON/lib/socket.js";
import { drawTeamAndPlayerInfo } from "./teamAndPlayer.js";
import MatchStages from "../COMMON/data/matchstages.json" with { type: "json" };

console.log(MatchStages);

const socket = new WebSocketManager('127.0.0.1:24050');

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

    // 存储当前比赛阶段
    currentMatchStageIndex: -1,
    currentMatchStage: null,
    currentOperationTeam: null,
    switchSidesInterval: null,

    // 先 ban 方在 match stages 中记为 Team A
    matchStageTeams: {
        A: null,
        B: null,
    }
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
 * 根据 matchstages.json 处理比赛阶段, 设置操作方, 设置 currentOperation 并处理选图方自动轮换
 */
function handleMatchStageChange() {
    // 使用选过的图的数量作为当前比赛阶段，避免额外存状态变量
    cache.currentMatchStageIndex = cache.pickedMaps.length;
    cache.currentMatchStage = MatchStages[cache.currentMatchStageIndex];
    if (cache.currentMatchStage === null || cache.currentMatchStage === undefined) {
        console.error("Invalid match stage");
        return;
    }

    if (currentOperation.type === 'Ban' || currentOperation.type === 'Blank') {
        // 如果当前操作是 ban 或 blank, 则直接进入下一阶段
        setIsMatchStageAdvancing(1);
    }

    // 根据当前操作方计算先 ban 方
    // 先 ban 方在 match stages 中记为 Team A
    // 执行到此处时, currentOperation 为刚进行的操作的操作方, match stage 为下一个操作
    // 对比上一个 match stage 与当前操作方, 下面的异或成立说明 A 对应 Red
    let lastStageTeamIsB = MatchStages[cache.currentMatchStageIndex - 1].team === 'B';
    let currentOperationTeamIsRed = currentOperation.team === 'Red';
    if (lastStageTeamIsB ^ currentOperationTeamIsRed) {
        cache.matchStageTeams['A'] = TEAM_RED;
        cache.matchStageTeams['B'] = TEAM_BLUE;
    }
    else {
        cache.matchStageTeams['A'] = TEAM_BLUE;
        cache.matchStageTeams['B'] = TEAM_RED;
    }
    cache.currentOperationTeam = cache.matchStageTeams[cache.currentMatchStage.team];

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
            const chatHtml = chat
                .map((item) => {
                    switch (item.team) {
                        case "left":
                            return `<p><span class="time">${item.time}&nbsp;</span> <span class="player-a-name-chat">${item.name}:&nbsp;</span>${item.messageBody}</p>`;
                        case "right":
                            return `<p><span class="time">${item.time}&nbsp;</span> <span class="player-b-name-chat">${item.name}:&nbsp;</span>${item.messageBody}</p>`;
                        case "bot":
                        case "unknown":
                            return `<p><span class="time">${item.time}&nbsp;</span> <span class="unknown-chat">${item.name}:&nbsp;</span>${item.messageBody}</p>`;
                    }
                })
                .join("");
            document.getElementById("chat-content").innerHTML = chatHtml;
            var element = document.getElementById("chat-content");
            element.scrollTop = element.scrollHeight;
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
            applyOperationToDOM(TEAM_RED, -1, "blank", false);
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
            applyOperationToDOM(TEAM_BLUE, -1, "blank", false);
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
                document.getElementById("team-a-operation").innerHTML = "";
                document.getElementById("team-b-operation").innerHTML = "";
                document.getElementById("map-pool-mod-container").innerHTML = "";
                localStorage.setItem("beatmapSelections", JSON.stringify([]));
                currentOperation = null;
                onCurrentRoundChange();

                clearPickStatus = 0;
                document.getElementById("button-clear-picks").textContent = "清空所有BP";
                document.getElementById("button-clear-picks").classList.remove("button-warning");
                document.getElementById("button-clear-picks").classList.add("button-active");

                toggleAllowAutoPick(false);
                cache.pickedMaps = [];
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
    });
document
    .getElementById("button-b-blank")
    .addEventListener("contextmenu", function () {
        let operationContainer = document.getElementById("team-b-operation");
        //删除ID为team-b-blank的子元素
        operationContainer.removeChild(document.getElementById("team-b-blank"));
        // 从localstorage删除操作
        deleteBeatmapSelectionById("BLUE_BLANK");
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
        // 确保容器存在
        if (teamAContainer && teamBContainer) {
            teamAContainer.innerHTML = "";
            teamBContainer.innerHTML = "";

            beatmapSelections.forEach(operation => {
                const { team, type } = operation;
                applyOperationToDOM(team, Number(operation.beatmapId), type.toLocaleLowerCase(), false);
            })
        }
    }
}

function onCurrentRoundChange() {
    document.getElementById("current-match").innerText =
        "当前场次：" + currentRoundName;

    // 从Localstorage找回所有上方谱面操作
    restoreBeatmapSelection();

    // 根据场次名称找到本场谱面
    getBeatmapListByRoundName(currentRoundName).then((beatmaps) => {
        // 填充map-pool-mod-container
        const mapPool = document.getElementById("map-pool-mod-container");
        mapPool.innerHTML = "";

        let currentMod = "";
        let mod;
        let index = 0;

        // 创建一个文档片段
        const fragment = document.createDocumentFragment();

        beatmaps.forEach((beatmap) => {
            if (beatmap.Mods !== currentMod) {
                currentMod = beatmap.Mods;
                mod = document.createElement("div");
                mod.className = "map-pool-mod";
                fragment.appendChild(mod);
                index = 0;
            }

            const map = document.createElement("button");
            map.className =
                "map-pool-button-base map-pool-button-" +
                currentMod.toLocaleLowerCase();
            map.id = `${beatmap.ID}`;

            // 生成HTML
            map.innerText = currentMod + (index + 1);
            mod.appendChild(map);

            // 为map元素添加事件监听器
            setupMapListeners(map);

            index++;
        });

        // 将文档片段添加到DOM中
        mapPool.appendChild(fragment);

        // 统计mod下map的数量，如果大于4 则添加map-pool-wide类
        countMapsAndAddWideClass();
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

    // 删除操作
    map.addEventListener("contextmenu", (event) => {
        console.log(beatmapId);
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

        // 删除控制台里的样式
        map.classList.remove("map-pool-button-a-pick");
        map.classList.remove("map-pool-button-a-ban");
        map.classList.remove("map-pool-button-b-pick");
        map.classList.remove("map-pool-button-b-ban");

        // 从localstorage删除操作
        deleteBeatmapSelectionById(beatmapId);

        event.preventDefault();
    });
}

/**
 * 将选图情况更新至控制台
 * 目前的实现很脏而且效率很低
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

function countMapsAndAddWideClass() {
    const mods = document.getElementsByClassName("map-pool-mod");
    for (let i = 0; i < mods.length; i++) {
        const mod = mods[i];
        const maps = mod.getElementsByClassName("map-pool-button-base");
        if (maps.length > 4) {
            mod.classList.add("map-pool-wide");
        }
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
