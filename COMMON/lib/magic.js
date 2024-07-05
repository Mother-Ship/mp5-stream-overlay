async function fetchMagicData() {
    const response = await fetch('../COMMON/data/magic.json');
    return response.json();
}

export function getMagicByCode(code) {
    return fetchMagicData().then(data => {
        return data.find(magic => magic.code === code);
    });
}

export function storeCurrentMagic(code) {
    localStorage.setItem('currentMagic', code);
}

export function getCurrentMagic(code) {
    return localStorage.getItem('currentMagic');
}

export function clearCurrentMagic() {
    localStorage.removeItem('currentMagic');
}