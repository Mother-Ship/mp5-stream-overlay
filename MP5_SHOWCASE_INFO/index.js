// connecting to websocket
import {getModNameAndIndexById} from '../COMMON/lib/bracket.js';
import WebSocketManager from "../COMMON/lib/socket.js";

const socket = new WebSocketManager('127.0.0.1:24050');

const cache = {
    md5: "",
};


document.addEventListener('selectstart', function (e) {
    e.preventDefault();
})

socket.api_v1(({menu}) => {

    try {

        var md5 = menu.bm.md5;
        if (md5 !== cache.md5) {
            cache.md5 = md5;

            if (menu.bm.metadata.artistOriginal !== null && menu.bm.metadata.artistOriginal !== "") {
                document.getElementById("map-title").innerText = menu.bm.metadata.artistOriginal + " - " + menu.bm.metadata.titleOriginal;
            } else {
                document.getElementById("map-title").innerText = menu.bm.metadata.artist + " - " + menu.bm.metadata.title;

            }
            document.getElementById("map-diff").innerText =
                "[" + menu.bm.metadata.difficulty + "]"
                + " By " + menu.bm.metadata.mapper;

            document.getElementById("map-data-container").style.display = 'flex';
            document.getElementById("map-bg").src = "http://localhost:24050/Songs/" + menu.bm.path.full;


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


            // 由于Showcase时 部分定制离线图还未上传，因此在这里打个表做硬编码
            if (menu.bm.id === 0){
                if (menu.bm.md5 === "39bdcd2724553603a4a926cd52bf8cc2"){
                    document.getElementById("mods").innerText = "DT1";
                }
                if (menu.bm.md5 === "b0cbc7e91bf6cc6fdfe40b53cddd1127"){
                    document.getElementById("mods").innerText = "NM2";
                }
            }else{
                //读取bracket.json处理mod
                const mod = getModNameAndIndexById(menu.bm.id);
                mod.then(mod => {
                    document.getElementById("mods").innerText = mod.modName + mod.index;
                });
            }


        }


    } catch (error) {
        console.log(error);
    }
});