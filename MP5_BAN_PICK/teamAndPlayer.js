import {getTeamFullInfoByName} from "../COMMON/lib/bracket.js";

export function drawTeamAndPlayerInfo(tourney, cache){

    if (
        tourney.manager.teamName.left !== cache.leftTeam ||
        tourney.manager.teamName.right !== cache.rightTeam
    ) {
        cache.leftTeam = tourney.manager.teamName.left;
        cache.rightTeam = tourney.manager.teamName.right;

        getTeamFullInfoByName(tourney.manager.teamName.left).then(
            (leftTeam) => {
                // 设置队伍头像、名称
                setLeftTeamAvatar(leftTeam.Acronym);

                document.getElementById("team-a-name").innerText = leftTeam.FullName;
                // 设置队伍成员
                document.getElementById("team-a-player-list").innerHTML = "";
                appendPlayersToList(leftTeam.Players, "team-a-player-list", 'team-a');
            }
        )

        getTeamFullInfoByName(tourney.manager.teamName.right).then(
            (rightTeam) => {
                // 设置队伍头像、名称
                setRightTeamAvatar(rightTeam.Acronym);

                document.getElementById("team-b-name").innerText = rightTeam.FullName;
                document.getElementById("team-b-player-list").innerHTML = "";
                appendPlayersToList(
                    rightTeam.Players,
                    "team-b-player-list",
                    "team-b",
                );
            },
        );
    }
}


function appendPlayersToList(players, listId, teamName) {
    const fragment = document.createDocumentFragment();
    players.forEach((player) => {
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
