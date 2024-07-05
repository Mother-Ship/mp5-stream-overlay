// connecting to websocket
import WebSocketManager from '../COMMON/lib/socket.js';
import {getModNameAndIndexById} from '../COMMON/lib/bracket.js'; // 路径根据实际情况调整

const socket = new WebSocketManager('127.0.0.1:24050');


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
socket.api_v1(({menu}) => {

    try {
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
                ;
            }

            document.getElementById("map-data-container").style.display = 'block';

            // document.getElementById("map-cover").src = "https://assets.ppy.sh/beatmaps/" + menu.bm.set + "/covers/card@2x.jpg?";
            // document.getElementById("map-cover").src = "https://assets.ppy.sh/beatmaps/" + menu.bm.set + "/covers/card@2x.jpg?";
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


        }

    } catch (error) {
        console.log(error);
    }
});