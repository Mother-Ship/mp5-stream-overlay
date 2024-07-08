import { __wbg_init, calculate_sr } from './rosu-pp/rosu_pp.js';

class OsuParser {
    constructor(wasmPath) {
        __wbg_init(wasmPath).then(() => {
            this.wasmReady = true;
        });
    }

    DEBUG = true;
    wasmReady = false;

    async parse(addr, mods=0) {
        if (!this.wasmReady) return;

        let res = await fetch(addr);
        let text = await res.text();
        let parsed = await this.read(text, mods);
        return parsed;
    };

    round(num, d) {
        const mul = Number(num) * Math.pow(10, d);
        return Math.round(mul) / Math.pow(10, d);
    };

    escape(str) {
        str = encodeURIComponent(str.replace(/\\/g, '/'))
            .replace(/-/g, '%2D')
            .replace(/_/g, '%5F')
            .replace(/\./g, '%2E')
            .replace(/!/g, '%21')
            .replace(/~/g, '%7E')
            .replace(/\'/g, '%27')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29');
        return str;
    };

    timeModifier(mods) {
        let timeModifier = 1;
        if (Number(mods) & 64) timeModifier = 1.5;
        if (Number(mods) & 256) timeModifier = 0.75;
        return timeModifier;
    };

    getModdedTime(time, mods) {
        return Number(time) / this.timeModifier(mods);
    };

    odToWindow(mode, od) {
        od = Number(od);
        let window300 = -1;
        switch (Number(mode)) {
            case 0:
                window300 = 80 - 6 * od;
                break;
            case 1:
                window300 = 50 - 3 * od;
                break;
            case 3:
                window300 = 64 - 3 * od;
                break;
            default:
                break;
        }
        return window300;
    };

    windowToOd(mode, window) {
        window = Number(window);
        let od = -1;
        switch (Number(mode)) {
            case 0:
                od = (80 - window) / 6;
                break;
            case 1:
                od = (50 - window) / 3
                break;
            case 3:
                od = (64 - window) / 3;
                break;
            default:
                break;
        }
        return od;
    };

    calcModdedOd(mods, mode, od) {
        //https://osu.ppy.sh/wiki/en/Beatmap/Overall_difficulty
        od = Number(od);
        mods = Number(mods);
        if (mode == 2) return -1; //in CTB, OD is not used and doesn't have a formula in osu! wiki, so TODO here.

        //calculate the effect of HR/EZ
        if (mods & 16) od = od * 1.4;
        if (mods & 2) od = od / 2;
        if (od > 10) od = 10;

        //calculate the effect of DT/HT
        let window300 = this.odToWindow(mode, od);
        let timeModifier = this.timeModifier(mods);
        window300 = window300 / timeModifier;
        let newod = this.windowToOd(mode, window300);

        return this.round(newod, 2)
    };

    calcModdedAr(mods, mode, ar) {
        //https://osu.ppy.sh/wiki/en/Beatmap/Approach_rate
        ar = Number(ar);
        mods = Number(mods);
        if (mode == 1 || mode == 3) return -1; //AR only presents in STD and CTB

        //calculate the effect of HR/EZ
        if (mods & 16) ar = ar * 1.4;
        if (mods & 2) ar = ar / 2;
        if (ar > 10) ar = 10;

        //calculate the effect of DT/HT
        let preempt = -1;
        if (ar <= 5) {
            preempt = 1800 - 120 * ar;
        }
        else {
            preempt = 1950 - 150 * ar;
        }
        let timeModifier = this.timeModifier(mods);
        preempt = preempt / timeModifier;
        let newar = -1;
        if (preempt >= 1200) {
            newar = (1800 - preempt) / 120;
        }
        else {
            newar = (1950 - preempt) / 150;
        }

        return this.round(newar, 2);
    };

    calcModdedCs(mods, mode, cs) {
        //https://osu.ppy.sh/wiki/en/Beatmap/Circle_Size
        cs = Number(cs);
        mods = Number(mods);

        //calculate the effect of HR/EZ
        if (mods & 16) cs = cs * 1.3;
        if (mods & 2) cs = cs / 2;
        if (cs > 10) cs = 10;

        return this.round(cs, 2);
    };

    calcModdedHp(mods, mode, hp) {
        //https://osu.ppy.sh/wiki/en/Beatmap/HP_Drain_Rate
        hp = Number(hp);
        mods = Number(mods);

        //calculate the effect of HR/EZ
        if (mods & 16) hp = hp * 1.4;
        if (mods & 2) hp = hp / 2;
        if (hp > 10) hp = 10;

        return this.round(hp, 2);
    };

    deepCopy(obj) {
        return JSON.parse(JSON.stringify(obj));
    }


    state = -1;
    states = [
        'general',
        'editor',
        'metadata',
        'difficulty',
        'events',
        'timingpoints',
        'colours',
        'hitobjects',
    ];
    keyValReg = /^([a-zA-Z0-9]+)[ ]*:[ ]*(.+)$/;
    sectionReg = /^\[([0-9A-Za-z]+)\]$/;

    toBeatmap(content) {
        let bm = {
            difficulty: {
                ar: Number(content.ApproachRate) || -1,
                od: Number(content.OverallDifficulty) || -1,
                cs: Number(content.CircleSize) || -1,
                hp: Number(content.HPDrainRate) || -1,
                sr: this.getSR(content.original, 0),
            },
            metadata: {
                title: content.Title || '',
                titleUnicode: content.TitleUnicode || '',
                artist: content.Artist || '',
                artistUnicode: content.ArtistUnicode || '',
                source: content.Source || '',
                tags: content.Tags || '',
                bid: Number(content.BeatmapID) || -1,
                sid: Number(content.BeatmapSetID) || -1,
                diff: content.Version || '',
                creator: content.Creator || '',
            },
            beatmap: {
                mode: content.Mode,
                bpm: this.getBPM(content.timings, Number(content.objs[0][2]), Number(content.objs[content.objs.length - 1][2])) || { min: -1, max: -1, mostly: -1 },
                length: this.getTotalTime(content) || -1,
                drain: this.getDrainTime(content) || -1,
                mods: 0,
                bg: this.getBGPath(content) || { path: '', xoffset: 0, yoffset: 0 },
            },
            original: content.original,
            index: -1,
            mod: 'Unknown',
        }

        if (this.DEBUG)
            console.log(`[osuFileParser] Parsed Beamap:\n${JSON.stringify(bm)}`);

        return bm;
    };

    getModded (bm, mods = 0) {
        let modded = {
            difficulty: {
                ar: this.calcModdedAr(mods, 0, bm.difficulty.ar),
                od: this.calcModdedOd(mods, 0, bm.difficulty.od),
                cs: this.calcModdedCs(mods, 0, bm.difficulty.cs),
                hp: this.calcModdedHp(mods, 0, bm.difficulty.hp),
                sr: this.getSR(bm.original, mods),
            },
            metadata: bm.metadata,
            beatmap: {
                length: this.getModdedTime(bm.beatmap.length, mods),
                drain: this.getModdedTime(bm.beatmap.drain, mods),
                mods: mods,
                bpm: {
                    min: bm.beatmap.bpm.min * this.timeModifier(mods),
                    max: bm.beatmap.bpm.max * this.timeModifier(mods),
                    mostly: bm.beatmap.bpm.mostly * this.timeModifier(mods),
                },
                bg: bm.beatmap.bg,
                mode: bm.beatmap.mode,
            },
            original: bm.original,
            index: bm.index,
            mod: bm.mod,
        }

        if (this.DEBUG)
            console.log(`[osuFileParser] Beatmap with mod ${mods}:\n${JSON.stringify(bm)}`);

        return modded;
    }

    parseFile(content) {
        let tmp = {
            timings: [],
            objs: [],
            events: [],
            colors: {},
            original: JSON.parse(JSON.stringify(content)),
        };
        content = content || '';

        content = content.split(/\r?\n/);

        content.forEach((line) => {
            if (line.substr(0, 2) == '//' || !line);
            else this.readLine(line, tmp);
        }, this);

        Object.keys(tmp.colors).map(
            (i) => (tmp.colors[i] = tmp.colors[i].split(','))
        );
        if (tmp.Bookmarks) tmp.Bookmarks = tmp.Bookmarks.split(',');

        return tmp;
    };

    readLine(line, tmp) {
        line = line || '';
        if (line.match(/osu file format v[0-9]+/)) return;

        let sectionMatch = line.match(this.sectionReg);
        if (sectionMatch) {
            this.updateState(sectionMatch[1]);
        }
        else {
            switch (this.state) {
                case 0:
                case 1:
                case 2:
                case 3:
                    // General, Editor, Metadata, Difficulty. These are all key-value pairs
                    let keyValPair = line.match(this.keyValReg);
                    if (keyValPair) {
                        tmp[keyValPair[1]] = keyValPair[2];
                    }
                    break;
                case 4:
                    // Events
                    let val = line.trim().split(',');
                    if (val) tmp.events.push(val);
                    break;
                case 5:
                    // TimingPoints
                    let timing = line.trim().split(',');
                    if (timing) tmp.timings.push(timing);
                    break;
                case 6:
                    // Colours
                    let color = line.match(this.keyValReg);
                    if (color) {
                        tmp.colors[color[1]] = color[2];
                    }
                    break;
                case 7:
                    // HitObjects
                    let hit = line.trim().split(',');
                    if (hit) tmp.objs.push(hit);
                    break;
            }
        }
    };

    updateState(section) {
        this.state = this.states.indexOf(section.toLowerCase());
    };

    getBPM(timings, begin, end) {
        let bpm = {
            min: 2e9,
            max: -1,
            mostly: -1,
        };

        let bpmList = {},
            lastBegin = begin, lastBPM = -1;

        for (let i of timings) {
            if (i[1] > '0') {
                if(Number(i[0]) < begin) continue;
                if (lastBPM && lastBPM > 0) {
                    if (!bpmList[lastBPM]) bpmList[lastBPM] = 0;
                    bpmList[lastBPM] += Number(i[0]) - lastBegin;
                }
                let currentBPM = lastBPM = this.round(60000 / Number(i[1]), 2);
                if (currentBPM < bpm.min) bpm.min = currentBPM;
                if (currentBPM > bpm.max) bpm.max = currentBPM;
                lastBegin = Number(i[0]);
            }
        }
        if (lastBPM && lastBPM > 0) {
            if (!bpmList[lastBPM]) bpmList[lastBPM] = 0;
            bpmList[lastBPM] += end - lastBegin;
        }
        if (bpm.min == 2e9) bpm.min = -1;
        if (bpm.max === bpm.min) {
            bpm.mostly = bpm.max;
        }
        else {
            if (this.DEBUG) {
                console.log(`bpm list: ${JSON.stringify(bpmList)}`);
            }
            bpm.mostly = Number(Object.keys(bpmList).reduce((a, b) => bpmList[a] > bpmList[b] ? a : b));
        }
        return bpm;
    };

    getTotalTime(content) {
        let first = Number(content.objs[0][2]) || 0, last = Number(content.objs[content.objs.length - 1][2]);
        if (this.DEBUG) console.log(`[osuFileParser] hit objects begin at ${first}, end at ${last}, total time ${last - first}`);
        return last - first;
    };

    getDrainTime(content) {
        let breakLength = 0;
        for (let line of content.events) {
            if (line[0] == '2' || line[0].toLowerCase == 'break') {
                breakLength += Number(line[2]) - Number(line[1]);
            }
        }
        if (this.DEBUG) console.log(`[osuFileParser] total break time length: ${breakLength}`)

        return this.getTotalTime(content) - breakLength;
    };

    getBGPath(content) {
        let bg = {
            path: '',
            xoffest: 0,
            yoffset: 0,
        }
        const regBG = /^0,0,\"?([^,\"]+)\"?(\,(\d+)\,(\d+))?$/;
        for (let line of content.events) {
            if (line[0] === '0' && line[1] === '0') {
                bg.path = line[2].match(/^\"(.+)\"$/)[1];
                bg.xoffest = line[3] || 0;
                bg.yoffset = line[4] || 0;
            }
        }
        return bg;
    };

    getSR(content, mods = 0) {
        if (!this.wasmReady) return -1;
        if (mods < 0) mods = 0; // Default to nomod
        let text = content.trim();
        let u8arr = new TextEncoder().encode(text);
        let sr = calculate_sr(u8arr, mods);
        return sr;
    };

    async read(fileContent, mods = 0) {
        return this.toBeatmap(this.parseFile(fileContent), mods);
    };
};

export default OsuParser;