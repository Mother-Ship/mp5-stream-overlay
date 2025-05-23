// connecting to websocket
import WebSocketManager from '../COMMON/lib/socket.js';

import {
    fetchBracketData,
    getModEnumFromModString,
    getModNameAndIndexById,
    getStoredBeatmapById,
    getTeamFullInfoByName,
    setIsMatchStageAdvancing,
    getIsMatchStageAdvancing
} from "../COMMON/lib/bracket.js";
import { CountUp } from '../COMMON/lib/countUp.min.js';
import { Odometer } from '../COMMON/lib/odometer-countup.js';
import OsuParser from '../COMMON/lib/osuParser.js';
import MapMock from '../COMMON/lib/mock.js';
import { __wbg_init } from '../COMMON/lib/rosu-pp/rosu_pp.js';


await __wbg_init('../COMMON/lib/rosu-pp/rosu_pp_bg.wasm');
const socket = new WebSocketManager('127.0.0.1:24050');
const p = new OsuParser();
const mock = new MapMock();

await mock.init();

const teamAScore = new CountUp('team-a-score', 0, { duration: 0.5, useGrouping: true });
const teamBScore = new CountUp('team-b-score', 0, { duration: 0.5, useGrouping: true });
const mapAr = new CountUp('map-ar', 0, {
    // plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
    duration: 0.5,
    decimalPlaces: 1
}),
    mapOd = new CountUp('map-od', 0, {
        // plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
        duration: 0.5,
        decimalPlaces: 1
    }),
    mapCs = new CountUp('map-cs', 0, {
        // plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
        duration: 0.5,
        decimalPlaces: 1
    }),
    mapHp = new CountUp('map-hp', 0, {
        // plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
        duration: 0.5,
        decimalPlaces: 1
    }),
    mapBpm = new CountUp('map-bpm', 0, {
        // plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
        duration: 0.5,
    }),
    mapStar = new CountUp('map-star', 0, {
        // plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
        duration: 0.5,
        decimalPlaces: 2,
        suffix: '*',
    }),
    mapLengthMinutes = new CountUp('map-length-minutes', 0, {
        // plugin: new Odometer({ duration: 0.2, lastDigitDelay: 0 }),
        duration: 0.5,
        formattingFn: x => x.toString().padStart(2, "0"),
    }),
    mapLengthSeconds = new CountUp('map-length-seconds', 0, {
        // plugin: new Odometer({ duration: 0.2, lastDigitDelay: 0 }),
        duration: 0.5,
        formattingFn: x => x.toString().padStart(2, "0"),
    }),
    teamAScoreLead = new CountUp('team-a-score-lead', 0, { duration: 0.5, useGrouping: true, prefix: '+' }),
    teamBScoreLead = new CountUp('team-b-score-lead', 0, { duration: 0.5, useGrouping: true, prefix: '+' });


const cache = {
    state: 0,
    stateTimer: null,

    leftTeamName: "",
    rightTeamName: "",

    leftScore: 0,
    rightScore: 0,

    bestOF: 0,

    leftStar: 0,
    rightStar: 0,

    chat: [],

    md5: "",

    mapChoosed: false,
};


/**
 * 右上角轮播图
 */
const slides = document.querySelectorAll('.slide');
let currentSlide = 0;

function nextSlide() {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length; // 循环到第一张
    slides[currentSlide].classList.add('active');
}

function initPage() {
    setInterval(nextSlide, 10000);
    let currentMatchRound = localStorage.getItem('currentMatchRound');
    if (currentMatchRound !== null) {
        document.getElementById("match-round").innerText = currentMatchRound;
    }

    // obs-browser feature checks
    if (window.obsstudio) {
        console.log('OBS Browser Source detected, version:', window.obsstudio.pluginVersion);
        console.log('Feature checks..');
        window.obsstudio.getControlLevel(function (level) {
            console.log(`OBS browser control level: ${level}`);

            if (level < 1) {
                // READ_OBS not available
                console.log('READ_OBS not available');
                document.getElementById('button-record-ack').style.display = 'block';
            } else {
                // We can read status, so show notification only when not recording
                document.getElementById('notify-record').textContent = "你现在没在录像，别忘了开！"
                window.obsstudio.getStatus(function (status) {
                    if (status.recording) {
                        document.getElementById('notify-record').style.display = 'none';
                    }

                    window.addEventListener('obsRecordingStarted', () => {
                        document.getElementById('notify-record').style.display = 'none';
                    });
                    window.addEventListener('obsRecordingStopped', () => {
                        document.getElementById('notify-record').style.display = 'block';
                    });
                })
            }
        });
    } else {
        console.log('Not OBS Browser or OBS control features not supported');
        document.getElementById('button-record-ack').style.display = 'block';
    }
}

if (document.readyState !== 'loading') {
    initPage();
} else {
    document.addEventListener('DOMContentLoaded', initPage);
}


// tosu IPC states:
// 1: Idle
// 2: ?
// 3: Playing
// 4: Ranking
function handleIpcStateChange(state) {
    if (state == cache.state) return;
    cache.state = state;
    switch (state) {
        case 1:
            // Enter idle state, show chat
            toggleChat(true);
            break;
        case 3:
            // Enter playing state, hide chat
            toggleChat(false);
            break;
        case 4:
            // Enter ranking state, show chat after 10s, similar to how Lazer works
            if (cache.stateTimer) clearTimeout(cache.stateTimer);
            cache.stateTimer = setTimeout(() => {
                toggleChat(true);
            }, 10000);

            // 设置比赛进程更新 flag
            let currentMatchAdvanceCount = getIsMatchStageAdvancing();
            if (currentMatchAdvanceCount === 0 || currentMatchAdvanceCount === false) {
                setIsMatchStageAdvancing(1);
                console.log('设置比赛进程更新 flag');
            } else {
                setIsMatchStageAdvancing(currentMatchAdvanceCount + 1);
                console.warn('比赛进程更新计数非零，是否有未操作的选图？');
            }
            break;
    }
}

function toggleChat(enable) {
    if (enable) {
        console.log('隐藏分数条、歌曲信息，展示聊天框')
        document.getElementById('chat').classList.remove('fade-out');
        document.getElementById('chat').style.opacity = "1";
        document.getElementById('chat').classList.add('fade-in');

        document.getElementById('map-info-container').style.display = 'none';
        document.getElementById('team-a-score-bar').style.display = 'none';
        document.getElementById('team-b-score-bar').style.display = 'none';
    } else {
        console.log('隐藏聊天框，展示分数条、歌曲信息')
        document.getElementById('chat').classList.remove('fade-in');
        document.getElementById('chat').classList.add('fade-out');
        document.getElementById('chat').style.opacity = "0";
        setTimeout(() => {
            document.getElementById('map-info-container').style.display = 'block';
            document.getElementById('team-a-score-bar').style.display = 'block';
            document.getElementById('team-b-score-bar').style.display = 'block';

        }, 500)
    }
}


document.addEventListener('selectstart', function (e) {
    e.preventDefault();
})

document.getElementById('button-chat-toggle').addEventListener('click', () => {
    toggleChat(document.getElementById('chat').style.opacity == "0");
});

document.getElementById('button-record-ack').addEventListener('click', () => {
    document.getElementById('notify-record').style.display = 'none';
    document.getElementById('button-record-ack').style.display = 'none';
})

socket.api_v1(async ({ menu, tourney }) => {

    try {
        // 歌曲信息
        var md5 = menu.bm.md5;
        if (md5 !== cache.md5) {
            document.getElementById("map-cover").src = "http://localhost:24050/Songs/" + encodeURIComponent(menu.bm.path.folder) + "/" + encodeURIComponent(menu.bm.path.bg);
            cache.md5 = md5;

            cache.mapChoosed = false;
            document.getElementById("map-info-container").classList.remove("picked-by-team-b")
            document.getElementById("map-mod-container").classList.remove("team-b-map-mod-container")
            document.getElementById("map-mod").classList.remove("team-b-map-mod")
            document.getElementById("map-info-container").classList.remove("picked-by-team-a")
            document.getElementById("map-mod-container").classList.remove("team-a-map-mod-container")
            document.getElementById("map-mod").classList.remove("team-a-map-mod")

            let parsed = await p.parse(`http://${location.host}/Songs/${encodeURIComponent(menu.bm.path.folder)}/${encodeURIComponent(menu.bm.path.file)}`);

            let modNameAndIndex = await getModNameAndIndexById(parsed.metadata.bid);
            parsed.mod = modNameAndIndex.modName;
            parsed.index = modNameAndIndex.index;

            let mods = getModEnumFromModString(parsed.mod);
            parsed.modded = p.getModded(parsed, mods);


            if (parsed.modded.metadata.artistUnicode !== null && parsed.modded.metadata.artistUnicode !== "") {
                document.getElementById("map-title").innerText =
                    parsed.modded.metadata.artistUnicode
                    + " - "
                    + parsed.modded.metadata.titleUnicode
                    + " [" + parsed.modded.metadata.diff + "]";
            } else {
                document.getElementById("map-title").innerText =
                    parsed.modded.metadata.artist
                    + " - "
                    + parsed.modded.metadata.title
                    + " [" + parsed.modded.metadata.diff + "]";
            }

            document.getElementById("map-data-container").style.display = 'block';

            mapAr.update(parseFloat(parsed.modded.difficulty.ar).toFixed(1));
            mapCs.update(parseFloat(parsed.modded.difficulty.cs).toFixed(1));
            mapOd.update(parseFloat(parsed.modded.difficulty.od).toFixed(1));
            mapHp.update(parseFloat(parsed.modded.difficulty.hp).toFixed(1));

            mapLengthMinutes.update(Math.trunc(parsed.modded.beatmap.length / 60000));
            mapLengthSeconds.update(Math.trunc(parsed.modded.beatmap.length % 60000 / 1000));

            mapBpm.update(parsed.modded.beatmap.bpm.mostly);
            mapStar.update(parsed.modded.difficulty.sr.toFixed(2));
        }

        if (!cache.mapChoosed) {
            var bid = menu.bm.id;
            let modNameAndIndex = await getModNameAndIndexById(bid);

            // TB needs some special treatments
            if (modNameAndIndex.modName === "TB") {
                document.getElementById("map-mod").innerText = modNameAndIndex.modName + String(modNameAndIndex.index);

                document.getElementById("map-info-container").classList.remove("picked-by-team-b")
                document.getElementById("map-mod-container").classList.remove("team-b-map-mod-container")
                document.getElementById("map-mod").classList.remove("team-b-map-mod")
                document.getElementById("map-info-container").classList.remove("picked-by-team-a")
                document.getElementById("map-mod-container").classList.remove("team-a-map-mod-container")
                document.getElementById("map-mod").classList.remove("team-a-map-mod")

                document.getElementById("map-info-container").classList.add("picked-tiebreaker")
                document.getElementById("map-mod-container").classList.add("tiebreaker-map-mod-container")
                document.getElementById("map-mod").classList.add("tiebreaker-map-mod")
            } else {
                const operation = getStoredBeatmapById(bid.toString());
                console.log(operation);
                if (operation !== null) {
                    cache.mapChoosed = true;
                    if (operation.type === "Pick") {

                        document.getElementById("map-mod").innerText = modNameAndIndex.modName + String(modNameAndIndex.index);

                        if (operation.team === "Red") {
                            document.getElementById("map-info-container").classList.remove("picked-by-team-b")
                            document.getElementById("map-mod-container").classList.remove("team-b-map-mod-container")
                            document.getElementById("map-mod").classList.remove("team-b-map-mod")

                            document.getElementById("map-info-container").classList.remove("picked-tiebreaker")
                            document.getElementById("map-mod-container").classList.remove("tiebreaker-map-mod-container")
                            document.getElementById("map-mod").classList.remove("tiebreaker-map-mod")

                            document.getElementById("map-info-container").classList.add("picked-by-team-a")
                            document.getElementById("map-mod-container").classList.add("team-a-map-mod-container")
                            document.getElementById("map-mod").classList.add("team-a-map-mod")
                        }
                        if (operation.team === "Blue") {
                            document.getElementById("map-info-container").classList.remove("picked-by-team-a")
                            document.getElementById("map-mod-container").classList.remove("team-a-map-mod-container")
                            document.getElementById("map-mod").classList.remove("team-a-map-mod")

                            document.getElementById("map-info-container").classList.remove("picked-tiebreaker")
                            document.getElementById("map-mod-container").classList.remove("tiebreaker-map-mod-container")
                            document.getElementById("map-mod").classList.remove("tiebreaker-map-mod")

                            document.getElementById("map-info-container").classList.add("picked-by-team-b")
                            document.getElementById("map-mod-container").classList.add("team-b-map-mod-container")
                            document.getElementById("map-mod").classList.add("team-b-map-mod")
                        }
                    }
                }
            }
        }


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
        handleIpcStateChange(tourney.manager.ipcState || 0);

        // 双边分数
        setScoreBars(tourney);

        // 双边星星槽位
        const bestOF = tourney.manager.bestOF;
        if (bestOF !== cache.bestOF) {

            cache.bestOF = bestOF;
            const max = parseInt(bestOF / 2 + 1);
            // 清空原有星星
            document.getElementById("team-a-star-container").innerHTML = "";

            for (let i = 0; i < max; i++) {
                const star = document.createElement("div");
                star.className = "team-a-star-slot";
                document.getElementById("team-a-star-container").appendChild(star);
            }

            // 清空原有星星
            document.getElementById("team-b-star-container").innerHTML = "";

            for (let i = 0; i < max; i++) {
                const star = document.createElement("div");
                star.className = "team-b-star-slot";
                document.getElementById("team-b-star-container").appendChild(star);
            }
        }

        // 双边星星
        const leftStar = tourney.manager.stars.left
        if (leftStar !== cache.leftStar) {
            cache.leftStar = leftStar;


            const max = parseInt(cache.bestOF / 2 + 1)
            for (let i = 0; i < max; i++) {
                document.getElementById("team-a-star-container").children[i].className = "team-a-star-slot";
            }
            for (let i = 0; i < leftStar; i++) {
                const childElement = document.getElementById("team-a-star-container").children[i];
                childElement.className = "team-a-star";
            }

        }
        const rightStar = tourney.manager.stars.right
        if (rightStar !== cache.rightStar) {
            cache.rightStar = rightStar;

            const max = parseInt(cache.bestOF / 2 + 1)

            for (let i = 0; i < max; i++) {
                document.getElementById("team-b-star-container").children[i].className = "team-b-star-slot";
            }
            // 从右到左替换样式
            for (let i = 0; i < rightStar; i++) {
                const childElement = document.getElementById("team-b-star-container").children[max - i - 1];
                childElement.className = "team-b-star";
            }
        }


        // 双边队名 旗帜
        const leftTeamName = tourney.manager.teamName.left;
        if (leftTeamName !== cache.leftTeamName) {
            cache.leftTeamName = leftTeamName;
            getTeamFullInfoByName(leftTeamName).then(
                (leftTeam) => {
                    // 设置队伍头像、名称
                    document.getElementById("team-a-name").innerText = leftTeam.FullName;
                    setLeftTeamAvatar(leftTeam.Acronym);
                }
            )
        }
        const rightTeamName = tourney.manager.teamName.right;
        if (rightTeamName !== cache.rightTeamName) {
            cache.rightTeamName = rightTeamName;
            getTeamFullInfoByName(rightTeamName).then(
                (rightTeam) => {
                    document.getElementById("team-b-name").innerText = rightTeam.FullName;
                    setRightTeamAvatar(rightTeam.Acronym);
                }
            )
        }
    } catch (error) {
        console.log(error);
    }
});

function setLeftTeamAvatar(acronym) {
    var basePath = "../COMMON/img/flag/" + acronym;
    var imgElement = document.getElementById("team-a-avatar");
    setTeamAvatar(imgElement, basePath);
}

function setRightTeamAvatar(acronym) {
    var basePath = "../COMMON/img/flag/" + acronym;
    var imgElement = document.getElementById("team-b-avatar");
    setTeamAvatar(imgElement, basePath);
}

function setTeamAvatar(imgElement, basePath) {

    var imgFormats = ['jpg', 'jpeg', 'png']; // 支持的格式
    var found = false;

    imgFormats.forEach(function (format) {
        if (!found) {
            var imgUrl = basePath + "." + format;
            var img = new Image();
            img.onload = function () {
                imgElement.src = imgUrl; // 加载成功，更新图片
                found = true; // 停止尝试其他格式
            };
            img.onerror = function () {
                // 如果加载失败，继续尝试下一个格式
            };
            img.src = imgUrl;
        }
    });
}


// 控制台逻辑

// 点击button-match-qf和button-match-gf时，点亮自身，熄灭round-control-buttons内其他按钮，修改match-round的文本为按钮文本
const matchRound = document.getElementById("match-round");

function storeMatchRound() {
    localStorage.setItem('currentMatchRound', matchRound.innerText);
}

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

document.getElementById("button-match-qf").addEventListener("click", () => {
    matchRound.innerText = "小组赛";

    activateButton("button-match-qf");

    deactivateButtons("button-match-gf", "button-match-sf", "button-match-f",
        "button-match-winner", "button-match-loser");

    storeMatchRound();
});
document.getElementById("button-match-gf").addEventListener("click", () => {
    matchRound.innerText = "总决赛";

    activateButton("button-match-gf");

    deactivateButtons("button-match-qf", "button-match-sf", "button-match-f",
        "button-match-winner", "button-match-loser");

    storeMatchRound();
});

// 点击button-match-sf和button-match-f时，点亮自身和"button-match-winner", "button-match-loser"，
// 熄灭round-control-buttons内其他按钮，修改match-round的文本为按钮文本
document.getElementById("button-match-sf").addEventListener("click", () => {
    matchRound.innerText = "半决赛";
    activateButton("button-match-sf");
    activateButton("button-match-winner");
    activateButton("button-match-loser");
    deactivateButtons("button-match-qf", "button-match-gf", "button-match-f");
});

document.getElementById("button-match-f").addEventListener("click", () => {
    matchRound.innerText = "决赛";
    activateButton("button-match-f");
    activateButton("button-match-winner");
    activateButton("button-match-loser");
    deactivateButtons("button-match-qf", "button-match-gf", "button-match-sf");
});

// 点击"button-match-winner", "button-match-loser"时，给match-round文本前面追加胜者组或败者组
document.getElementById("button-match-winner").addEventListener("click", () => {
    if (matchRound.innerText === "决赛" || matchRound.innerText === "半决赛") {
        matchRound.innerText = "胜者组" + matchRound.innerText;
        storeMatchRound();
    }
    if (matchRound.innerText.includes("败者组")) {
        matchRound.innerText = matchRound.innerText.replace("败者组", "胜者组");
        storeMatchRound();
    }
});
document.getElementById("button-match-loser").addEventListener("click", () => {
    if (matchRound.innerText === "决赛" || matchRound.innerText === "半决赛") {
        matchRound.innerText = "败者组" + matchRound.innerText;
        storeMatchRound();
    }
    if (matchRound.innerText.includes("胜者组")) {
        matchRound.innerText = matchRound.innerText.replace("胜者组", "败者组");
        storeMatchRound();
    }
});

document.addEventListener('contextmenu', function (event) {
    event.preventDefault();
})

function setScoreBars(tourney) {
    const scores = {
        left: {
            score: 0,
        },
        right: {
            score: 0,
        },
        bar: -1,
    }

    const leftClients = tourney.ipcClients.filter(client => client.team === 'left');
    const rightClients = tourney.ipcClients.filter(client => client.team === 'right');
    let scoreDiff = 0;


    scores.left.score = (leftClients.map(client => client.gameplay.score)).reduce((acc, score) => acc + score, 0);
    scores.right.score = (rightClients.map(client => client.gameplay.score)).reduce((acc, score) => acc + score, 0);
    scoreDiff = Math.abs(scores.left.score - scores.right.score);
    scores.bar = Math.min(0.4, Math.pow(scoreDiff / 1500000, 0.5) / 2) * 1000 + 100;

    if (scores.left.score !== cache.leftScore || scores.right.score !== cache.rightScore) {
        cache.leftScore = scores.left.score;
        cache.rightScore = scores.right.score;

        const leftScore = scores.left.score;
        const rightScore = scores.right.score;
        const scoreDiff = Math.abs(leftScore - rightScore);

        // 分数条，狂抄Lazer https://github.com/ppy/osu/blob/master/osu.Game/Screens/Play/HUD/MatchScoreDisplay.cs#L145
        if (leftScore == rightScore) {
            document.getElementById('team-a-score-bar').style.width = 100 + "px";
            document.getElementById('team-b-score-bar').style.width = 100 + "px";

            document.getElementById("team-a-score").style.fontSize = '50px';
            document.getElementById("team-b-score").style.fontSize = '50px';

            document.getElementById('team-a-score-lead').style.visibility = 'hidden';
            document.getElementById('team-b-score-lead').style.visibility = 'hidden';
        } else if (leftScore > rightScore) {
            document.getElementById('team-b-score-bar').style.width = 100 + "px";
            document.getElementById('team-a-score-bar').style.width = scores.bar + "px";

            document.getElementById("team-a-score").style.fontSize = '75px';
            document.getElementById("team-b-score").style.fontSize = '50px';

            document.getElementById('team-a-score-lead').style.visibility = 'visible';
            document.getElementById('team-b-score-lead').style.visibility = 'hidden';
        } else {
            document.getElementById('team-a-score-bar').style.width = 100 + "px";
            document.getElementById('team-b-score-bar').style.width = scores.bar + "px";

            document.getElementById("team-a-score").style.fontSize = '50px';
            document.getElementById("team-b-score").style.fontSize = '75px';

            document.getElementById('team-a-score-lead').style.visibility = 'hidden';
            document.getElementById('team-b-score-lead').style.visibility = 'visible';
        }

        // 分数文字
        teamAScore.update(leftScore);
        teamBScore.update(rightScore);

        teamAScoreLead.update(scoreDiff);
        teamBScoreLead.update(scoreDiff);
    }
}
