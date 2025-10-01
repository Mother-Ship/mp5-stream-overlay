export async function fetchBracketData() {
    const response = await fetch('../COMMON/data/bracket.json');
    return response.json();
}

export function getAllRound() {
    return fetchBracketData().then(data => {
        const allRounds = [];
        for (const round of data.Rounds) {
            allRounds.push({
                roundName: round.Name
            });
        }
        return allRounds;
    });
}

export function getBeatmapListByRoundName(name) {
    return fetchBracketData().then(data => {
        for (const round of data.Rounds) {
            if (round.Name === name) {
                return round.Beatmaps;
            }
        }
    });
}

export function getTeamFullInfoByName(teamName) {
    return fetchBracketData().then(data => {
        for (const team of data.Teams) {
            if (team.FullName === teamName) {
                return team;
            }
        }
    });
}

function getBeatmapListGroupedByRoundAndMods() {
    return fetchBracketData().then(data => {
        const structured = {};
        for (const round of data.Rounds) {
            if (Array.isArray(round.Beatmaps)) {
                structured[round.Name] = {};
                for (const beatmap of round.Beatmaps) {
                    if (!structured[round.Name][beatmap.Mods]) {
                        structured[round.Name][beatmap.Mods] = [];
                    }
                    structured[round.Name][beatmap.Mods].push(beatmap);
                }
            }
        }
        return structured;
    });
}

export function getStructuredBeatmapsByRound(roundName) {
    return getBeatmapListGroupedByRoundAndMods().then(data => data[roundName] || {});
}

export function getBeatmapLookupByBeatmapID() {
    // This implementation doesn't work when the same beatmap is present multiple times, or in multiple rounds
    return fetchBracketData().then(data => {
        const reverseLookup = {};
        for (const round of data.Rounds) {
            if (Array.isArray(round.Beatmaps)) {
                for (const beatmap of round.Beatmaps) {
                    reverseLookup[beatmap.ID] = beatmap;
                }
            }
        }
        return reverseLookup;
    });
}

export function getModNameAndIndexById(bid) {
    return getBeatmapListGroupedByRoundAndMods().then(data => {
        console.log('Searching for bid:', bid);
        let foundMap = null;
        let mods = '';
        let index = '';
        for (const roundName in data) {
            const round = data[roundName];
            for (const modName in round) {
                const beatmaps = round[modName];
                for (let i = 0; i < beatmaps.length; i++) {
                    const beatmap = beatmaps[i];
                    if (beatmap.ID === bid) {
                        foundMap = beatmap;
                        mods = modName;
                        index = round[modName].length > 1 ? (i + 1) : ''; // 序号通常从1开始计数
                        break;
                    }
                }
                if (foundMap) {
                    break;
                }
            }
            if (foundMap) {
                break;
            }
        }
        if (foundMap) {
            return {
                modName: mods,
                index: index
            };
        } else {
            console.warn(`Beatmap with ID ${bid} not found.`);
            return {
                modName: "UN",
                index: -1,
            };
        }
    });
}


export function getFullBeatmapFromBracketById(bid) {
    return fetchBracketData().then(data => {
        for (const round of data.Rounds) {
            if (Array.isArray(round.Beatmaps)) {
                for (const beatmap of round.Beatmaps) {
                    if (beatmap.ID === bid) {
                        return beatmap;
                    }
                }
            }
        }
    });

}

export function storeBeatmapSelection(item) {
    let beatmapSelections;
    const key = 'beatmapSelections';

    // 尝试从localStorage获取已存在的Map
    const stored = localStorage.getItem(key);
    if (stored && JSON.parse(stored).length > 0) {
        beatmapSelections = new Map(JSON.parse(stored));
    } else {
        beatmapSelections = new Map();
    }

    // 添加或更新新的条目
    beatmapSelections.set(item.beatmapId, item);

    // 将Map序列化后存回localStorage
    localStorage.setItem(key, JSON.stringify(Array.from(beatmapSelections.entries())));
}


export function getStoredBeatmapById(beatmapID) {
    const key = 'beatmapSelections';
    const storedData = localStorage.getItem(key);

    if (storedData && JSON.parse(storedData).length > 0) {
        const beatmapSelections = new Map(JSON.parse(storedData));
        if (beatmapSelections.has(beatmapID)) {
            return beatmapSelections.get(beatmapID);
        }
    }

    return null; // 如果没有找到对应的ID，则返回null
}

export function getStoredBeatmap() {
    const key = 'beatmapSelections';
    const storedData = localStorage.getItem(key);

    if (storedData && JSON.parse(storedData).length > 0) {
        return new Map(JSON.parse(storedData));
    }

    return null; // 如果没有找到对应的ID，则返回null
}


export function clearBeatmapSelections() {
    localStorage.removeItem('beatmapSelections');
}

export function deleteBeatmapSelectionById(beatmapID) {
    const key = 'beatmapSelections';
    let beatmapSelections;

    // 获取现有的Map
    const stored = localStorage.getItem(key);
    if (stored && JSON.parse(stored).length > 0) {
        beatmapSelections = new Map(JSON.parse(stored));
    } else {
        return; // 如果没有存储的数据，直接返回
    }

    // 删除指定的条目
    if (beatmapSelections.has(beatmapID)) {
        beatmapSelections.delete(beatmapID);
    }

    // 更新localStorage
    localStorage.setItem(key, JSON.stringify(Array.from(beatmapSelections.entries())));
}

export function getIsMatchStageAdvancing() {
    const key = 'isMatchStageAdvancing';
    const storedData = localStorage.getItem(key);
    return storedData ? JSON.parse(storedData) : false;
}

export function setIsMatchStageAdvancing(isAdvancing) {
    const key = 'isMatchStageAdvancing';
    localStorage.setItem(key, JSON.stringify(isAdvancing));
}

const modEnum = {
    'NM': 0,
    'HD': 8,
    'HR': 16,
    'DT': 64,
    'FM': 0,
    'TB': 0,
}
export function getModEnumFromModString(mod) {
    mod = mod || 'NM'; // 默认显示原始数据
    return modEnum[mod.toUpperCase()] || 0;
}
