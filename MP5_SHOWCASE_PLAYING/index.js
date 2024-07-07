// connecting to websocket
import WebSocketManager from '../COMMON/lib/socket.js';
import {getModNameAndIndexById} from '../COMMON/lib/bracket.js'; // 路径根据实际情况调整
import OsuParser from '../COMMON/lib/osuParser.js';

const socket = new WebSocketManager('127.0.0.1:24050');
const p = new OsuParser('../COMMON/lib/rosu-pp/rosu_pp_bg.wasm');

const cache = {
    md5: "",
};



document.addEventListener('DOMContentLoaded', function () {
    const slides = document.querySelectorAll('.slide');
    let currentSlide = 0;

    function nextSlide() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length; // 循环到第一张
        slides[currentSlide].classList.add('active');
    }

    // 自动轮播，每10秒切换一次
    setInterval(nextSlide, 10000);
});

document.addEventListener('selectstart', function (e) {
    e.preventDefault();
})
socket.api_v1(async ({menu}) => {

    try {
        var md5 = menu.bm.md5;
        if (md5 !== cache.md5) {
            cache.md5 = md5;

            let parsed = await p.parse(`http://${location.host}/Songs/${menu.bm.path.folder}/${menu.bm.path.file}`, menu.mods.num);

            if (parsed.metadata.artistUnicode !== null && menu.bm.metadata.artistOriginal !== "") {
                document.getElementById("map-title").innerText =
                    parsed.metadata.artistUnicode
                    + " - "
                    + parsed.metadata.titleUnicode
                    + " [" + parsed.metadata.diff + "]";

            } else {
                document.getElementById("map-title").innerText =
                    parsed.metadata.artist
                    + " - "
                    + parsed.metadata.title
                    + " [" + parsed.metadata.diff + "]";
                ;
            }

            document.getElementById("map-data-container").style.display = 'block';

            // document.getElementById("map-cover").src = "https://assets.ppy.sh/beatmaps/" + menu.bm.set + "/covers/card@2x.jpg?";
            // document.getElementById("map-cover").src = "https://assets.ppy.sh/beatmaps/" + menu.bm.set + "/covers/card@2x.jpg?";
            document.getElementById("map-cover").src = "http://localhost:24050/Songs/" + menu.bm.path.full;


            document.getElementById("map-ar").innerText = parseFloat(parsed.modded.difficulty.ar).toFixed(1);
            document.getElementById("map-cs").innerText = parseFloat(parsed.modded.difficulty.cs).toFixed(1);
            document.getElementById("map-od").innerText = parseFloat(parsed.modded.difficulty.od).toFixed(1);
            document.getElementById("map-hp").innerText = parseFloat(parsed.modded.difficulty.hp).toFixed(1);


            document.getElementById("map-length").innerText =
                //毫秒数转分：秒
                Math.trunc(parsed.modded.beatmap.length / 60000) + ":" +
                //毫秒数转秒， 个位数前面添0
                Math.trunc(parsed.modded.beatmap.length % 60000 / 1000).toString().padStart(2, "0");

            document.getElementById("map-bpm").innerText = parsed.modded.beatmap.bpm.mostly;

            document.getElementById("map-star").innerText = parsed.modded.difficulty.sr.toFixed(2) + "*";


        }

    } catch (error) {
        console.log(error);
    }
});