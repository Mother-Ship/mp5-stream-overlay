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

export function getModNameAndIndexById(bid) {
    return fetchBracketData().then(data => {
        let findedMap = null;
        let mods = '';
        let index = 1;
        for (const round of data.Rounds) {
            if (Array.isArray(round.Beatmaps)) {
                for (const beatmap of round.Beatmaps) {
                    if (beatmap.Mods !== mods) {
                        index = 1;
                    }
                    mods = beatmap.Mods;
                    if (beatmap.ID === bid) {
                        findedMap = beatmap;
                        // 退出2层循环
                        break;
                    }
                    index++;
                }
            }
            if (findedMap) {
                break;
            }
        }
        if (findedMap) {
            return {
                modName: findedMap.Mods,
                index: index // 序号通常从1开始计数
            };
        } else {
            throw new Error(`Beatmap with ID ${bid} not found.`);
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
    if (stored) {
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

    if (storedData) {
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

    if (storedData) {
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
    if (stored) {
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
