// connecting to websocket
import WebSocketManager from '../COMMON/lib/socket.js';
import {getMagicByCode} from "../COMMON/lib/magic.js";
import {getModNameAndIndexById, getStoredBeatmapById, getTeamFullInfoByName} from "../COMMON/lib/bracket.js";


const socket = new WebSocketManager('127.0.0.1:24050');


const cache = {
    leftName: "",
    rightName: "",

    leftScore: 0,
    rightScore: 0,

    bestOF: 0,

    leftStar: 0,
    rightStar: 0,

    chat: [],

    md5: "",
};


/**
 * 右上角轮播图
 */
document.addEventListener('DOMContentLoaded', function () {
    const slides = document.querySelectorAll('.slide');
    let currentSlide = 0;

    function nextSlide() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length; // 循环到第一张
        slides[currentSlide].classList.add('active');
    }

    setInterval(nextSlide, 10000);
});

let scoreUpdateTimer = setTimeout(() => {
    console.log('隐藏分数条、歌曲信息，展示聊天框')
    document.getElementById('chat').classList.remove('fade-out');
    document.getElementById('chat').style.opacity = "1";
    document.getElementById('chat').classList.add('fade-in');

    document.getElementById('map-info-container').style.display = 'none';
    document.getElementById('team-a-score-bar').style.display = 'none';
    document.getElementById('team-b-score-bar').style.display = 'none';
}, 5000);


document.addEventListener('selectstart', function (e) {
    e.preventDefault();
})


socket.api_v1(({menu, tourney}) => {

    try {
        // 歌曲信息
        var md5 = menu.bm.md5;
        if (md5 !== cache.md5) {
            cache.md5 = md5;
            if (menu.bm.metadata.artistOriginal !== null && menu.bm.metadata.artistOriginal !== "") {
                document.getElementById("map-title").innerText =
                    menu.bm.metadata.artistOriginal
                    + " - "
                    + menu.bm.metadata.titleOriginal
                    + " [" + menu.bm.metadata.difficulty + "]";
            } else {
                document.getElementById("map-title").innerText =
                    menu.bm.metadata.artist
                    + " - "
                    + menu.bm.metadata.title
                    + " [" + menu.bm.metadata.difficulty + "]";
            }

            document.getElementById("map-data-container").style.display = 'block';
            document.getElementById("map-cover").src = "http://localhost:24050/Songs/" + menu.bm.path.full;

            document.getElementById("map-ar").innerText = parseFloat(menu.bm.stats.AR).toFixed(1);
            document.getElementById("map-cs").innerText = parseFloat(menu.bm.stats.CS).toFixed(1);
            document.getElementById("map-od").innerText = parseFloat(menu.bm.stats.OD).toFixed(1);
            document.getElementById("map-hp").innerText = parseFloat(menu.bm.stats.HP).toFixed(1);


            document.getElementById("map-length").innerText =
                //毫秒数转分：秒
                Math.trunc(menu.bm.time.full / 60000) + ":" +
                //毫秒数转秒， 个位数前面添0
                Math.trunc(menu.bm.time.full % 60000 / 1000).toString().padStart(2, "0");

            document.getElementById("map-bpm").innerText = menu.bm.stats.BPM.common;
            document.getElementById("map-star").innerText = menu.bm.stats.fullSR.toFixed(2) + "*";


            // 获取这张图对应的操作信息

            var bid = menu.bm.id;
            const operation = getStoredBeatmapById(bid.toString())
            console.log(operation)
            if (operation !== null) {
                if (operation.type === "Pick") {
                    var mod = getModNameAndIndexById(bid);
                    mod.then(
                        (mod) => {
                            document.getElementById("map-mod").innerText = mod.modName + mod.index;
                        }
                    )

                    if (operation.team === "Red") {
                        document.getElementById("map-info-container").classList.add("picked-by-team-a")
                        document.getElementById("map-mod-container").classList.add("team-a-map-mod-container")
                        document.getElementById("map-mod").classList.add("team-a-map-mod")

                    }
                    if (operation.team === "Blue") {
                        document.getElementById("map-info-container").classList.add("picked-by-team-b")
                        document.getElementById("map-mod-container").classList.add("team-b-map-mod-container")
                        document.getElementById("map-mod").classList.add("team-b-map-mod")
                    }
                }
            }
        }
        // 聊天
        const chat = tourney.manager.chat;
        if (chat.length !== cache.chat.length) {
            cache.chat = chat;
            console.log(chat)
            // 根据chat内容生成HTML
            const chatHtml = chat.map(item => {
                return `${item.time}&nbsp;${item.name}&nbsp;${item.messageBody}<br>`
            }).join('');
            document.getElementById("chat-content").innerHTML = chatHtml;
            var element = document.getElementById("chat-content-container");
            element.scrollTop = element.scrollHeight;
        }

        // 双边分数
        const leftScore = tourney.manager.gameplay.score.left;
        const rightScore = tourney.manager.gameplay.score.right;


        if (leftScore !== cache.leftScore || rightScore !== cache.rightScore) {
            cache.leftScore = leftScore;
            cache.rightScore = rightScore;

            // 分数条，狂抄Lazer https://github.com/ppy/osu/blob/master/osu.Game/Screens/Play/HUD/MatchScoreDisplay.cs#L145
            var winningBar = leftScore > rightScore ? "team-a-score-bar" : "team-b-score-bar"
            var losingBar = leftScore <= rightScore ? "team-a-score-bar" : "team-b-score-bar";

            var diff = Math.max(leftScore, rightScore) - Math.min(leftScore, rightScore);
            var animationWidth = Math.min(1, Math.pow(diff / 1500000, 0.5) / 2) * 500 + 100;

            document.getElementById(losingBar).style.width = 100 + "px";
            document.getElementById(winningBar).style.width = animationWidth + "px";

            // 分数文字
            document.getElementById("team-a-score").innerText = leftScore.toLocaleString();
            document.getElementById("team-b-score").innerText = rightScore.toLocaleString();
            document.getElementById("team-a-score").style.fontSize = leftScore > rightScore ? "75px" : "50px";
            document.getElementById("team-b-score").style.fontSize = leftScore <= rightScore ? "75px" : "50px";

            // 隐藏分数条、歌曲信息，展示聊天框
            document.getElementById('chat').classList.remove('fade-in');
            document.getElementById('chat').classList.add('fade-out');
            document.getElementById('chat').style.opacity = "0";
            setTimeout(() => {
                document.getElementById('map-info-container').style.display = 'block';
                document.getElementById('team-a-score-bar').style.display = 'block';
                document.getElementById('team-b-score-bar').style.display = 'block';

            }, 500)

            // 重置计时器的执行时间
            clearTimeout(scoreUpdateTimer);
            scoreUpdateTimer = setTimeout(() => {
                console.log('隐藏分数条、歌曲信息，展示聊天框')
                document.getElementById('chat').classList.remove('fade-out');
                document.getElementById('chat').style.opacity = "1";
                document.getElementById('chat').classList.add('fade-in');

                document.getElementById('map-info-container').style.display = 'none';
                document.getElementById('team-a-score-bar').style.display = 'none';
                document.getElementById('team-b-score-bar').style.display = 'none';
            }, 5000);
        }

        // 双边星星槽位
        const bestOF = tourney.manager.bestOF;
        if (bestOF !== cache.bestOF) {

            cache.bestOF = bestOF;
            const max = bestOF / 2 + 0.5;
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


            const max = cache.bestOF / 2 + 0.5;
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

            const max = cache.bestOF / 2 + 0.5;

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
                    document.getElementById("team-a-avatar").src = "../COMMON/img/flag/" + leftTeam.Acronym + ".png"
                }
            )
        }
        const rightTeamName = tourney.manager.teamName.right;
        if (rightTeamName !== cache.rightTeamName) {
            cache.rightTeamName = rightTeamName;
            getTeamFullInfoByName(rightTeamName).then(
                (rightTeam) => {
                    document.getElementById("team-b-name").innerText = rightTeam.FullName;
                    document.getElementById("team-b-avatar").src = "../COMMON/img/flag/" + rightTeam.Acronym + ".png"
                }
            )
        }


    } catch (error) {
        console.log(error);
    }
});

// 控制台逻辑

// 点击button-match-qf和button-match-gf时，点亮自身，熄灭round-control-buttons内其他按钮，修改match-round的文本为按钮文本
const matchRound = document.getElementById("match-round");

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
    matchRound.innerText = "1/4决赛";

    activateButton("button-match-qf");

    deactivateButtons("button-match-gf", "button-match-sf", "button-match-f",
        "button-match-winner", "button-match-loser");
});
document.getElementById("button-match-gf").addEventListener("click", () => {
    matchRound.innerText = "总决赛";

    activateButton("button-match-gf");

    deactivateButtons("button-match-qf", "button-match-sf", "button-match-f",
        "button-match-winner", "button-match-loser");
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
    }
    if (matchRound.innerText.includes("败者组")) {
        matchRound.innerText = matchRound.innerText.replace("败者组", "胜者组");
    }
});
document.getElementById("button-match-loser").addEventListener("click", () => {
    if (matchRound.innerText === "决赛" || matchRound.innerText === "半决赛") {
        matchRound.innerText = "败者组" + matchRound.innerText;
    }
    if (matchRound.innerText.includes("胜者组")) {
        matchRound.innerText = matchRound.innerText.replace("胜者组", "败者组");
    }
});

let hideTimer;
// 找到id为magic-control-buttons下面的所有buttons 添加点击事件
document.querySelectorAll("#magic-control-buttons button").forEach(button => {
    button.addEventListener("click", () => {
        // 找到button的id，从magic.js获取对应魔法
        let magic = getMagicByCode(button.id);
        magic.then(
            (magic) => {
                // 修改magic-name  magic-note magic-full-note

                document.getElementById("magic-name").innerText =
                    magic.code + ": " + magic.name;
                document.getElementById("magic-note").innerText =
                    magic.name + ": " + magic.note;

                document.getElementById("magic-full-note").innerText = magic.fullNote;


                let operation = document.getElementById("magic-note-container");
                operation.classList.add('fade-in');
                operation.classList.add('blink');
                operation.style.opacity = "0.99";

                clearTimeout(hideTimer);
                hideTimer = setTimeout(function () {
                    operation.classList.add('fade-out');
                    operation.classList.remove('fade-in');
                    operation.classList.remove('blink');
                    operation.style.opacity = "0";
                }, 4000);
            }
        )
    });
    button.addEventListener("contextmenu", (event) => {
        document.getElementById("magic-name").innerText = ""
        document.getElementById("magic-full-note").innerText = ""
        let operation = document.getElementById("magic-note-container");
        operation.classList.add('fade-out');
        operation.classList.remove('fade-in');
        operation.classList.remove('blink');
        operation.style.opacity = "0";
    });
});

document.addEventListener('contextmenu', function (event) {
    event.preventDefault();
})
