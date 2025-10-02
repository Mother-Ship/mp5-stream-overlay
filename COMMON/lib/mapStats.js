export function setMatchStats(bid, item) {
    const key = 'matchStats';
    let matchStats = {};
    
    // 尝试从localStorage获取已存在的数据
    const stored = localStorage.getItem(key);
    if (stored) {
        matchStats = JSON.parse(stored);
    }
    
    // 更新或添加新的条目
    matchStats[bid] = item;
    
    // 将更新后的对象存回localStorage
    localStorage.setItem(key, JSON.stringify(matchStats));
}

export function getMatchStats() {
    const key = 'matchStats';
    const stored = localStorage.getItem(key);
    
    if (stored) {
        return JSON.parse(stored);
    }
    
    return {}; // 如果没有数据则返回空对象
}

export function getMatchStatsById(bid) {
    const key = 'matchStats';
    const stored = localStorage.getItem(key);
    if (stored) {
        const matchStats = JSON.parse(stored);
        return matchStats[bid] || null; // 如果存在则返回对应的条目，否则返回null
    }
    return null; // 如果没有数据则返回null
}

export function clearMatchStats() {
    localStorage.removeItem('matchStats');
}

export function removeMatchStatsById(bid) {
    const key = 'matchStats';
    const stored = localStorage.getItem(key);
    if (stored) {
        const matchStats = JSON.parse(stored);
        if (matchStats.hasOwnProperty(bid)) {
            delete matchStats[bid];
            localStorage.setItem(key, JSON.stringify(matchStats));
        }
    }
}

