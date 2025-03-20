// connecting to websocket
import { getModNameAndIndexById, getModEnumFromModString } from '../COMMON/lib/bracket.js';
import WebSocketManager from "../COMMON/lib/socket.js";
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

const cache = {
    md5: "",
};

const mapAr = new CountUp('map-ar', 0, {
    // // plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
    duration: 0.5,
    decimalPlaces: 1,
    }),
    mapOd = new CountUp('map-od', 0, {
        // plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
        duration: 0.5,
        decimalPlaces: 1,
    }),
    mapCs = new CountUp('map-cs', 0, {
        // plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
        duration: 0.5,
        decimalPlaces: 1,
    }),
    mapHp = new CountUp('map-hp', 0, {
        // plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
        duration: 0.5,
        decimalPlaces: 1,
    }),
    mapBpm = new CountUp('map-bpm', 0, {
        // plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
        duration: 0.5,
    }),
    mapLength = new CountUp('map-length', 0, {
        // plugin: new Odometer({ duration: 0.2, lastDigitDelay: 0 }),
        duration: 0.5,
        formattingFn: (x) => `${Math.trunc(x / 60000).toString().padStart(2, '0')}:${Math.trunc(x % 60000 / 1000).toString().padStart(2, '0')}`,
    }),
    mapSr = new CountUp('map-sr', 0, {
        // plugin: new Odometer({ duration: 0.3, lastDigitDelay: 0 }),
        duration: 0.5,
        decimalPlaces: 2,
    });


document.addEventListener('selectstart', function (e) {
    e.preventDefault();
})

socket.api_v1( async ({menu}) => {
    try {

        var md5 = menu.bm.md5;
        if (md5 !== cache.md5) {
            cache.md5 = md5;

            let parsed = await p.parse(`http://${location.host}/Songs/${encodeURIComponent(menu.bm.path.folder)}/${encodeURIComponent(menu.bm.path.file)}`);

            const modNameAndIndex = await getModNameAndIndexById(parsed.metadata.bid);
            parsed.mod = modNameAndIndex.modName;
            parsed.index = modNameAndIndex.index;
            mock.updateProperties(parsed);
            modNameAndIndex.modName = parsed.mod;
            modNameAndIndex.index = parsed.index;

            let mods = getModEnumFromModString(parsed.mod);
            parsed.modded = p.getModded(parsed, mods);

            if (parsed.modded.metadata.artistUnicode !== null && parsed.modded.metadata.artistUnicode !== "") {
                document.getElementById("map-title").innerText = parsed.modded.metadata.artistUnicode + " - " + parsed.modded.metadata.titleUnicode;
            } else {
                document.getElementById("map-title").innerText = parsed.modded.metadata.artist + " - " + parsed.modded.metadata.title;

            }
            document.getElementById("map-diff").innerText =
                "[" + parsed.modded.metadata.diff + "]"
                + " By " + parsed.modded.metadata.creator;

            document.getElementById("map-data-container").style.display = 'flex';
            document.getElementById("map-bg").src = "http://localhost:24050/Songs/" + encodeURIComponent(menu.bm.path.folder) + "/" + encodeURIComponent(menu.bm.path.bg);


            mapAr.update(parseFloat(parsed.modded.difficulty.ar).toFixed(1));
            mapCs.update(parseFloat(parsed.modded.difficulty.cs).toFixed(1));
            mapOd.update(parseFloat(parsed.modded.difficulty.od).toFixed(1));
            mapHp.update(parseFloat(parsed.modded.difficulty.hp).toFixed(1));

            mapLength.update(parsed.modded.beatmap.length);

            mapBpm.update(parsed.modded.beatmap.bpm.mostly); 
            mapSr.update(parsed.modded.difficulty.sr.toFixed(2));

            document.getElementById("mods").innerText = modNameAndIndex.modName + modNameAndIndex.index;
        }
    } catch (error) {
        console.log(error);
    }
});
