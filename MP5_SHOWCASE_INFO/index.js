// connecting to websocket
import {getModNameAndIndexById} from '../COMMON/lib/bracket.js';
import WebSocketManager from "../COMMON/lib/socket.js";
import { CountUp } from '../COMMON/lib/countUp.min.js';
import { Odometer } from '../COMMON/lib/odometer-countup.js';
import OsuParser from '../COMMON/lib/osuParser.js';


const socket = new WebSocketManager('127.0.0.1:24050');
const p = new OsuParser('../COMMON/lib/rosu-pp/rosu_pp_bg.wasm');

const cache = {
    md5: "",
};

const mapAr = new CountUp('map-ar', 0, {
    plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
    duration: 0.5,
    decimalPlaces: 1,
    }),
    mapOd = new CountUp('map-od', 0, {
        plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
        duration: 0.5,
        decimalPlaces: 1,
    }),
    mapCs = new CountUp('map-cs', 0, {
        plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
        duration: 0.5,
        decimalPlaces: 1,
    }),
    mapHp = new CountUp('map-hp', 0, {
        plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
        duration: 0.5,
        decimalPlaces: 1,
    }),
    mapBpm = new CountUp('map-bpm', 0, {
        plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
        duration: 0.5,
    }),
    mapLengthMinutes = new CountUp('map-length-minutes', 0, {
        plugin: new Odometer({ duration: 0.2, lastDigitDelay: 0 }),
        duration: 0.5,
        formattingFn: x => x.toString().padStart(2, "0"),
    }),
    mapLengthSeconds = new CountUp('map-length-seconds', 0, {
        plugin: new Odometer({ duration: 0.2, lastDigitDelay: 0 }),
        duration: 0.5,
        formattingFn: x => x.toString().padStart(2, "0"),
    });


document.addEventListener('selectstart', function (e) {
    e.preventDefault();
})

socket.api_v1( async ({menu}) => {

    try {

        var md5 = menu.bm.md5;
        if (md5 !== cache.md5) {
            cache.md5 = md5;

            let parsed = await p.parse(`http://${location.host}/Songs/${menu.bm.path.folder}/${menu.bm.path.file}`, menu.mods.num);

            if (parsed.metadata.artistUnicode !== null && parsed.metadata.artistUnicode !== "") {
                document.getElementById("map-title").innerText = parsed.metadata.artistUnicode + " - " + parsed.metadata.titleUnicode;
            } else {
                document.getElementById("map-title").innerText = parsed.metadata.artist + " - " + parsed.metadata.title;

            }
            document.getElementById("map-diff").innerText =
                "[" + parsed.metadata.diff + "]"
                + " By " + parsed.metadata.creator;

            document.getElementById("map-data-container").style.display = 'flex';
            document.getElementById("map-bg").src = "http://localhost:24050/Songs/" + menu.bm.path.full;


            mapAr.update(parseFloat(parsed.modded.difficulty.ar).toFixed(1));
            mapCs.update(parseFloat(parsed.modded.difficulty.cs).toFixed(1));
            mapOd.update(parseFloat(parsed.modded.difficulty.od).toFixed(1));
            mapHp.update(parseFloat(parsed.modded.difficulty.hp).toFixed(1));

            mapLengthMinutes.update(Math.trunc(parsed.modded.beatmap.length / 60000));
            mapLengthSeconds.update(Math.trunc(parsed.modded.beatmap.length % 60000 / 1000));

            mapBpm.update(parsed.modded.beatmap.bpm.mostly); 


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