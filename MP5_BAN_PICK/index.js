// connecting to websocket
import {
    deleteBeatmapSelectionById,
    getAllRound,
    getBeatmapListByRoundName,
    getFullBeatmapFromBracketById,
    getModNameAndIndexById,
    getStoredBeatmap,
    getStoredBeatmapById,
    getTeamFullInfoByName,
    storeBeatmapSelection
} from "../COMMON/lib/bracket.js";

import WebSocketManager from "../COMMON/lib/socket.js";

const socket = new WebSocketManager('127.0.0.1:24050');
const imgFormats = ['jpg', 'jpeg', 'png'];

// 左右两侧队伍信息缓存
const cache = {
    leftTeam: "",
    rightTeam: "",
    chat: [],
};

function appendPlayersToList(players, listId, teamName) {
    const fragment = document.createDocumentFragment();
    players.forEach(player => {
        const playerDiv = document.createElement("div");
        playerDiv.classList.add(`${teamName}-player`);
        playerDiv.innerHTML = `            
            <img class="${teamName}-player-avatar" src="https://a.ppy.sh/${player.id}?.png">
            <span class="${teamName}-player-name">${player.Username}</span>
        `;

        fragment.appendChild(playerDiv);
    });

    document.getElementById(listId).appendChild(fragment);
}

socket.api_v1(({tourney}) => {
    try {
        // 聊天
        const chat = tourney.manager.chat;
        if (chat.length !== cache.chat.length) {
            cache.chat = chat;
            const chatHtml = chat.map(item => {
                switch (item.team) {
                    case 'left':
                        return `<p><span class="time">${item.time}&nbsp;</span> <span class="player-a-name-chat">${item.name}:&nbsp;</span>${item.messageBody}</p>`
                    case 'right':
                        return `<p><span class="time">${item.time}&nbsp;</span> <span class="player-b-name-chat">${item.name}:&nbsp;</span>${item.messageBody}</p>`
                    case 'bot':
                    case 'unknown':
                        return `<p><span class="time">${item.time}&nbsp;</span> <span class="unknown-chat">${item.name}:&nbsp;</span>${item.messageBody}</p>`

                }
            }).join('');
            document.getElementById("chat-content").innerHTML = chatHtml;
            var element = document.getElementById("chat-content");
            element.scrollTop = element.scrollHeight;
        }

        if (tourney.manager.teamName.left !== cache.leftTeam || tourney.manager.teamName.right !== cache.rightTeam) {
            cache.leftTeam = tourney.manager.teamName.left;
            cache.rightTeam = tourney.manager.teamName.right;

            getTeamFullInfoByName(tourney.manager.teamName.left).then(
                (leftTeam) => {
                    // 设置队伍头像、名称
                    document.getElementById("team-a-avatar").srcset = imgFormats.map(function(format) {
                        return "../COMMON/img/flag/" + leftTeam.Acronym  + "." + format;
                    });

                    document.getElementById("team-a-name").innerText = leftTeam.FullName;
                    // 设置队伍成员
                    document.getElementById("team-a-player-list").innerHTML = "";
                    appendPlayersToList(leftTeam.Players, "team-a-player-list", 'team-a');
                }
            )

            getTeamFullInfoByName(tourney.manager.teamName.right).then(
                (rightTeam) => {
                    document.getElementById("team-b-avatar").srcset = imgFormats.map(function(format) {
                        return "../COMMON/img/flag/" + rightTeam.Acronym  + "." + format;
                    });

                    document.getElementById("team-b-name").innerText = rightTeam.FullName;
                    document.getElementById("team-b-player-list").innerHTML = "";
                    appendPlayersToList(rightTeam.Players, "team-b-player-list", 'team-b');
                }
            )
        }

    } catch (error) {
        console.log(error);
    }
});

function activateButton(buttonId) {
    document.getElementById(buttonId).classList.remove("button-inactive", "button-active");
    document.getElementById(buttonId).classList.add("button-active");
}

function deactivateButtons(...buttonIds) {
    buttonIds.forEach(buttonId => {
        document.getElementById(buttonId).classList.remove("button-inactive", "button-active");
        document.getElementById(buttonId).classList.add("button-inactive");
    });
}

document.addEventListener('selectstart', function (e) {
    e.preventDefault();
})

let allRound;
let currentRoundName;
getAllRound().then(
    (rounds) => {
        allRound = rounds;
        // 尝试从localstorage找回当前轮次，否则使用第一轮
        if (localStorage.getItem('currentRound')) {
            currentRoundName = localStorage.getItem('currentRound');
            locked = true;
            deactivateButtons("button-match-next", "button-match-previous")
            document.getElementById("lock").innerText = "解锁";
        } else {
            currentRoundName = rounds[0].roundName;
        }
        onCurrentRoundChange();
    }
)


let currentOperation = null;

document.getElementById('button-a-ban').addEventListener('click', function (e) {
    // 激活自己，熄灭其他ban pick按钮
    deactivateButtons('button-a-ban', 'button-a-pick', 'button-b-ban', 'button-b-pick');
    activateButton('button-a-ban');
    //去除team-a元素的background-color
    document.getElementById("team-a").style.backgroundColor = "#824242";
    //给team-b元素加上background-color
    document.getElementById("team-b").style.backgroundColor = "#202d45";
    // 准备好全局变量，类似于{ "team": "Red", "type": "Pick", "beatmapID": 2194138 }，只不过没有beatmapId
    currentOperation = {
        "team": "Red",
        "type": "Ban"
    };
})
document.getElementById('button-a-pick').addEventListener('click', function (e) {
    // 激活自己，熄灭其他ban pick按钮
    deactivateButtons('button-a-ban', 'button-a-pick', 'button-b-ban', 'button-b-pick');
    activateButton('button-a-pick');
    //去除team-a元素的background-color
    document.getElementById("team-a").style.backgroundColor = "#824242";
    //给team-b元素加上background-color
    document.getElementById("team-b").style.backgroundColor = "#202d45";
    currentOperation = {
        "team": "Red",
        "type": "Pick"
    };
})

document.getElementById('button-b-ban').addEventListener('click', function (e) {
    // 激活自己，熄灭其他ban pick按钮
    deactivateButtons('button-a-ban', 'button-a-pick', 'button-b-ban', 'button-b-pick');
    activateButton('button-b-ban');
    //去除team-b元素的background-color
    document.getElementById("team-b").style.backgroundColor = "#415a8a";
    //给team-a元素加上background-color
    document.getElementById("team-a").style.backgroundColor = "#412121";
    currentOperation = {
        "team": "Blue",
        "type": "Ban"
    }
})
document.getElementById('button-b-pick').addEventListener('click', function (e) {
    // 激活自己，熄灭其他ban pick按钮
    deactivateButtons('button-a-ban', 'button-a-pick', 'button-b-ban', 'button-b-pick');
    activateButton('button-b-pick');
    //去除team-b元素的background-color
    document.getElementById("team-b").style.backgroundColor = "#415a8a";
    //给team-a元素加上background-color
    document.getElementById("team-a").style.backgroundColor = "#412121";
    currentOperation = {
        "team": "Blue",
        "type": "Pick"
    }
})
document.getElementById('button-a-blank').addEventListener('click', function (e) {
    let operationContainer = document.getElementById("team-a-operation");
    // 如果没有ID为team-a-blank的子元素则创建
    if (!document.getElementById("team-a-blank")) {
        let operation = document.createElement("div");
        operation.id = "team-a-blank";
        operationContainer.appendChild(operation);
        storeBeatmapSelection(
            {
                "team": "Red",
                "type": "Blank",
                "beatmapId": "RED_BLANK"
            }
        )
    }
})
document.getElementById('button-b-blank').addEventListener('click', function (e) {
    let operationContainer = document.getElementById("team-b-operation");
    // 如果没有ID为team-b-blank的子元素则创建
    if (!document.getElementById("team-b-blank")) {
        let operation = document.createElement("div");
        operation.id = "team-b-blank";
        operationContainer.appendChild(operation);
        storeBeatmapSelection(
            {
                "team": "Blue",
                "type": "Blank",
                "beatmapId": "BLUE_BLANK"
            }
        )
    }
})

document.getElementById('button-clear-picks').addEventListener('click', function (e) {
    console.log('清空所有操作');
    deactivateButtons('button-a-ban', 'button-a-pick', 'button-b-ban', 'button-b-pick');
    document.getElementById("team-a-operation").innerHTML = "";
    document.getElementById("team-b-operation").innerHTML = "";
    document.getElementById("map-pool-mod-container").innerHTML = "";
    localStorage.setItem('beatmapSelections', JSON.stringify(new Map()));
    currentOperation = null;
    onCurrentRoundChange();
});

document.getElementById('button-a-blank').addEventListener('contextmenu', function (e) {
    let operationContainer = document.getElementById("team-a-operation");
    //删除ID为team-a-blank的子元素
    operationContainer.removeChild(document.getElementById("team-a-blank"));
    // 从localstorage删除操作
    deleteBeatmapSelectionById("RED_BLANK");
})
document.getElementById('button-b-blank').addEventListener('contextmenu', function (e) {
    let operationContainer = document.getElementById("team-b-operation");
    //删除ID为team-b-blank的子元素
    operationContainer.removeChild(document.getElementById("team-b-blank"));
    // 从localstorage删除操作
    deleteBeatmapSelectionById("BLUE_BLANK");
})

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
            // 使用Promise.all处理异步操作
            Promise.all(beatmapSelections.map(beatmapOperation => {
                // beatmapOperation.beatmapId转数字
                const bid = parseInt(beatmapOperation.beatmapId, 10);
                return getFullBeatmapFromBracketById(bid).then(beatmap => {
                    return getModNameAndIndexById(bid).then(mods => {
                        return [beatmap, mods, beatmapOperation];
                    });
                });
            })).then(results => {
                results.forEach(([beatmap, mods, beatmapOperation]) => {
                    // 根据所有Promise结果修改HTML
                    const {team, type} = beatmapOperation;
                    let operationContainer = team === TEAM_RED ? teamAContainer : teamBContainer;
                    let operation = document.createElement("div");
                    // 离线图的改动恰好兼容了空ban，这里找不到对应MOD也不会出现异常，而是直接插入空白div
                    if (type === "Blank") {
                        operation.id = team === TEAM_RED ? "team-a-blank" : "team-b-blank";
                        operationContainer.appendChild(operation);
                    } else {
                        operation.id = beatmap.ID;
                        if (type === "Pick") {
                            operation.classList.add(team === TEAM_RED ? "team-a-pick" : "team-b-pick");
                        }
                        if (type === "Ban") {
                            operation.classList.add(team === TEAM_RED ? "team-a-ban" : "team-b-ban");
                        }
                        const classPrefix = team === TEAM_RED ? "team-a" : "team-b"
                        operation.innerHTML = `  
                        <div class="${classPrefix}-map-cover-border">                      
                            <img class="${classPrefix}-map-cover"
                                 src="${beatmap.BeatmapInfo.Covers["card@2x"]}">
                        </div>
                        <div class="${classPrefix}-map-mod-container">
                            <span class="${classPrefix}-map-mod">${mods.modName}${mods.index}</span>
                        </div>
                    
                        <span class="${classPrefix}-map-title">${beatmap.BeatmapInfo.Metadata.title_unicode} [${beatmap.BeatmapInfo.DifficultyName}]</span>
                        <span class="${classPrefix}-map-artist"> - ${beatmap.BeatmapInfo.Metadata.artist_unicode}</span>
                    `;
                        operationContainer.appendChild(operation);
                        setTimeout(function () {
                            operation.classList.add('shown');
                        }, 1000);
                    }

                });
            }).catch(error => {
                console.error("Error restoring beatmap selections:", error);
            });
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
function appendOperation(beatmap, mods) {
    if (currentOperation.team === "Red") {
        let operationContainer = document.getElementById("team-a-operation");
        // 根据ban、pick生成一个div，追加到operationContainer
        let operation = document.createElement("div");
        operation.id = beatmap.ID;
        operation.classList.add("animated");
        if (currentOperation.type === "Pick") {
            operation.classList.add("team-a-pick");
        }
        if (currentOperation.type === "Ban") {
            operation.classList.add("team-a-ban");
        }
        operation.innerHTML = `
            <div class="team-a-map-cover-border">
                <img class="team-a-map-cover"
                    src="${beatmap.BeatmapInfo.Covers["card@2x"]}">
            </div>
            <div class="team-a-map-mod-container">
                <span class="team-a-map-mod">${mods.modName}${mods.index}</span>
            </div>
        
            <span class="team-a-map-title">${beatmap.BeatmapInfo.Metadata.title_unicode} [${beatmap.BeatmapInfo.DifficultyName}]</span>
            <span class="team-a-map-artist"> - ${beatmap.BeatmapInfo.Metadata.artist_unicode}</span>
        `
        operationContainer.appendChild(operation);

        // 延迟一秒后停止播放闪烁动画
        setTimeout(function () {
            operation.classList.add('shown');
        }, 1000);
    }
    if (currentOperation.team === "Blue") {
        let operationContainer = document.getElementById("team-b-operation");
        let operation = document.createElement("div");
        operation.id = beatmap.ID;
        operation.classList.add("animated");

        if (currentOperation.type === "Pick") {
            operation.classList.add("team-b-pick");
        }
        if (currentOperation.type === "Ban") {
            operation.classList.add("team-b-ban");
        }
        operation.innerHTML = `
            <div class="team-b-map-cover-border">
                  <img class="team-b-map-cover"
                              src="${beatmap.BeatmapInfo.Covers["card@2x"]}">
            </div>
            
            <div class="team-b-map-mod-container">
                <span class="team-b-map-mod">${mods.modName}${mods.index}</span>
            </div>

            <span class="team-b-map-title">${beatmap.BeatmapInfo.Metadata.title_unicode} [${beatmap.BeatmapInfo.DifficultyName}]</span>
            <span class="team-b-map-artist"> - ${beatmap.BeatmapInfo.Metadata.artist_unicode}</span>
            `
        operationContainer.appendChild(operation);

        setTimeout(function () {
            operation.classList.add('shown');
        }, 1000);
    }
}

function onCurrentRoundChange() {
    document.getElementById('current-match').innerText = "当前场次：" + currentRoundName;

    // 从Localstorage找回所有上方谱面操作
    restoreBeatmapSelection();


    // 根据场次名称找到本场谱面
    getBeatmapListByRoundName(currentRoundName)
        .then((beatmaps) => {
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
                        map.className = "map-pool-button-base map-pool-button-" + currentMod.toLocaleLowerCase();
                        map.id = `${beatmap.ID}`;

                        // 从Localstorage找回本场谱面操作
                        const operation = getStoredBeatmapById(beatmap.ID.toString())
                        if (operation !== null) {
                            applyOperationStyles(map, operation);
                        }

                        // 生成HTML
                        map.innerText = currentMod + (index + 1);
                        mod.appendChild(map);

                        // 为map元素添加事件监听器
                        setupMapListeners(map);

                        index++;
                    }
                )

                // 将文档片段添加到DOM中
                mapPool.appendChild(fragment);

                // 统计mod下map的数量，如果大于4 则添加map-pool-wide类
                countMapsAndAddWideClass();
            }
        );

}

function setupMapListeners(map) {
    const beatmapId = map.id;
    map.addEventListener('click', async () => {
        console.log(beatmapId);
        //beatmapId转数字
        const bid = parseInt(beatmapId, 10);
        // 使用Promise.all处理异步操作
        const [beatmap, mods] =
            await Promise.all([
                getFullBeatmapFromBracketById(bid),
                getModNameAndIndexById(bid)
            ]);

        deactivateButtons('button-a-ban', 'button-a-pick', 'button-b-ban', 'button-b-pick');

        if (currentOperation !== null) {
            currentOperation = {
                ...currentOperation,
                "beatmapId": beatmapId
            };
            // 存储操作到Localstorage
            storeBeatmapSelection(currentOperation);

            // 修改控制台按钮样式
            applyOperationStyles(map, currentOperation);

            // 向上方追加操作
            appendOperation(beatmap, mods);
        }

        currentOperation = null;
    });


    map.addEventListener('contextmenu', event => {
        console.log(beatmapId);
        // 更新上方BanPick容器 删除对当前谱面的操作
        const operationElements = [
            document.getElementById("team-a-operation"),
            document.getElementById("team-b-operation")
        ];

        operationElements.forEach(element => {
            element.querySelectorAll(`div[id="${beatmapId}"]`).forEach(
                operation => {
                    operation.classList.add('fade-out');
                    setTimeout(function () {
                        operation.remove()
                    }, 500);
                }
            );
        });

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

function applyOperationStyles(map, operation) {
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

document.getElementById('button-match-next').addEventListener('click', function (e) {
    if (locked) {
        return;
    }
    //切换currentRoundName到下一场
    for (let i = 0; i < allRound.length; i++) {
        if (allRound[i].roundName === currentRoundName) {
            console.log(i)
            if (i === allRound.length - 1) {
                currentRoundName = allRound[0].roundName;
            } else {
                currentRoundName = allRound[i + 1].roundName;
            }
            break;
        }
    }

    onCurrentRoundChange();

})

document.getElementById('button-match-previous').addEventListener('click', function (e) {
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
})

document.getElementById("lock").addEventListener('click', function (e) {
    if (locked) {
        locked = false;
        activateButton("button-match-next");
        activateButton("button-match-previous");
        document.getElementById("lock").innerText = "锁定";
        // 清除localstorage里当前轮次
        localStorage.removeItem('currentRound');
    } else {
        locked = true;
        deactivateButtons("button-match-next", "button-match-previous")
        document.getElementById("lock").innerText = "解锁";
        // 存储当前轮次到localstorage
        localStorage.setItem('currentRound', currentRoundName);
    }
})
document.addEventListener('contextmenu', function (event) {
    event.preventDefault();
})

