// connecting to websocket
import {
    deleteBeatmapSelectionById,
    getAllRound,
    getBeatmapListByRoundName,
    getFullBeatmapFromBracketById,
    getModNameAndIndexById,
    getStoredBeatmap,
    storeBeatmapSelection,
} from "../COMMON/lib/bracket.js";

import WebSocketManager from "../COMMON/lib/socket.js";
import { drawTeamAndPlayerInfo } from "./teamAndPlayer.js";

const socket = new WebSocketManager('127.0.0.1:24050');

const cache = {
    leftTeam: "",
    rightTeam: "",
    chat: [],
    md5: "",
    // auto BP only works for first beatmap change (or manual pick) after streamer manually chooses pick/ban side.
    // [TODO] auto-rotate pick/ban teams
    // [TODO] detect OBS scene change for fully automatic B/P
    canAutoPick: false,
    // mapChoosed 存储 canAutoPick 为假后谱面是否变动
    // [TODO] 改成某种方法判断是否已经切出过 BAN_PICK 场景, 这样就不用存这两个状态了
    lastChangedMapBid: null,

    // list of BIDs of picked/banned maps
    pickedMaps: [],
};

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
    }
    toggleAllowAutoPick(false);
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


let currentOperation = null;

document.getElementById("button-a-ban").addEventListener("click", function () {
    // 激活自己，熄灭其他ban pick按钮
    deactivateButtons(
        "button-a-ban",
        "button-a-pick",
        "button-b-ban",
        "button-b-pick",
    );
    activateButton("button-a-ban");
    //去除team-a元素的background-color
    document.getElementById("team-a").style.backgroundColor = "#824242";
    //给team-b元素加上background-color
    document.getElementById("team-b").style.backgroundColor = "#202d45";
    // 准备好全局变量，类似于{ "team": "Red", "type": "Pick", "beatmapID": 2194138 }，只不过没有beatmapId
    currentOperation = {
        team: "Red",
        type: "Ban",
    };

    toggleAllowAutoPick(true);
    tryAutoPick();
});
document
    .getElementById("button-a-pick")
    .addEventListener("click", function () {
        // 激活自己，熄灭其他ban pick按钮
        deactivateButtons(
            "button-a-ban",
            "button-a-pick",
            "button-b-ban",
            "button-b-pick",
        );
        activateButton("button-a-pick");
        //去除team-a元素的background-color
        document.getElementById("team-a").style.backgroundColor = "#824242";
        //给team-b元素加上background-color
        document.getElementById("team-b").style.backgroundColor = "#202d45";
        currentOperation = {
            team: "Red",
            type: "Pick",
        };

        toggleAllowAutoPick(true);
        tryAutoPick();
    });

document.getElementById("button-b-ban").addEventListener("click", function () {
    // 激活自己，熄灭其他ban pick按钮
    deactivateButtons(
        "button-a-ban",
        "button-a-pick",
        "button-b-ban",
        "button-b-pick",
    );
    activateButton("button-b-ban");
    //去除team-b元素的background-color
    document.getElementById("team-b").style.backgroundColor = "#415a8a";
    //给team-a元素加上background-color
    document.getElementById("team-a").style.backgroundColor = "#412121";
    currentOperation = {
        team: "Blue",
        type: "Ban",
    };

    toggleAllowAutoPick(true);
    tryAutoPick();
});
document
    .getElementById("button-b-pick")
    .addEventListener("click", function () {
        // 激活自己，熄灭其他ban pick按钮
        deactivateButtons(
            "button-a-ban",
            "button-a-pick",
            "button-b-ban",
            "button-b-pick",
        );
        activateButton("button-b-pick");
        //去除team-b元素的background-color
        document.getElementById("team-b").style.backgroundColor = "#415a8a";
        //给team-a元素加上background-color
        document.getElementById("team-a").style.backgroundColor = "#412121";
        currentOperation = {
            team: "Blue",
            type: "Pick",
        };

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
                localStorage.setItem("beatmapSelections", JSON.stringify(new Map()));
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


const TEAM_RED = "Red";
const TEAM_BLUE = "Blue";

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

/**
 * 追加一个对谱面的操作到上方
 *
 * 这两个if块可以提取共通逻辑，后续优化
 * @param beatmap
 * @param mods
 */
function appendOperation(beatmap) {
    // Ensure auto pick only works for the current operation
    toggleAllowAutoPick(false);

    applyOperationToDOM(currentOperation.team === "Red" ? TEAM_RED : TEAM_BLUE, beatmap.ID, currentOperation.type.toLocaleLowerCase(), { animate: true })
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
        }

        currentOperation = null;
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
    if(!operation) {
        return;
    }
    if(cache.pickedMaps.includes(map.id)) {
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
