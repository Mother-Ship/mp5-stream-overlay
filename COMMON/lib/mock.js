class MapMock {
    mocks = [];
    DEBUG = true;

    constructor() {

    }

    async init() {
        this.mocks = await this.loadMocks();
    }

    async loadMocks() {
        let mapmocks = await fetch('../COMMON/data/mapmock.json');
        return mapmocks.json();
    }

    checkMatch(bm) {
        let hasMatch = false, match = null;
        for (const mock of this.mocks) {
            if (mock.criterion === bm.metadata.title) {
                hasMatch = true;
                match = mock.values;
                break;
            }
        };

        if (this.DEBUG) {
            console.log(`[mock] 匹配 ${hasMatch}, ${bm.metadata.title} -> ${JSON.stringify(match)}`)
        }

        return { hasMatch, match };
    }

    updateProperties(bm) {
        let { hasMatch, match } = this.checkMatch(bm);
        if (hasMatch) {
            bm.mod = match.mod;
            this._replacePropertiesRecursive(bm, match);
            if (this.DEBUG) {
                console.log(`[mock] 替换后谱面信息:`);
                console.log(bm);
            }
        }
        return hasMatch;
    }

    _replacePropertiesRecursive(base, updates) {
        // 这段是问 Copilot 的
        for (const key in updates) {
            if (typeof updates[key] === 'object' && updates[key] !== null && !Array.isArray(updates[key])) {
                // If the property doesn't exist in the base object or is not an object, initialize it
                if (typeof base[key] !== 'object' || base[key] === null || Array.isArray(base[key])) {
                    base[key] = {};
                }
                // Recursively update properties
                this._replacePropertiesRecursive(base[key], updates[key]);
            } else {
                // Update the property in base if it exists in updates
                if (base.hasOwnProperty(key)) {
                    base[key] = updates[key];
                }
            }
        }
    }

}

export default MapMock;
