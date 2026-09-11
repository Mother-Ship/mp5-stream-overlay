const TEAM_RED = 'Red';
const TEAM_BLUE = 'Blue';

export class BPOrderStore {
    views = {};
    states = {
        firstBanTeam: null,
        firstPickTeam: null,
        matchStageTeams: { A: null, B: null, C: null, D: null },
    };
    props = {
        firstBanUpdateCallbacks: [],
        animationName: 'bp-order-fade-in',
        // this is needed to decide which side displays ban order
        // and if first/second icons are used
        firstOperationTeam: null,
        firstOperationType: null,
        bpimages: {},
    };

    constructor(views) {
        this.views = views;

        // prefetch images
        this.props.bpimages['RB-First'] = new Image();
        this.props.bpimages['RB-First'].src = '../COMMON/img/icon/BP/RB-First.svg';
        this.props.bpimages['BB-First'] = new Image();
        this.props.bpimages['BB-First'].src = '../COMMON/img/icon/BP/BB-First.svg';
        this.props.bpimages['RP-First'] = new Image();
        this.props.bpimages['RP-First'].src = '../COMMON/img/icon/BP/RP-First.svg';
        this.props.bpimages['BP-First'] = new Image();
        this.props.bpimages['BP-First'].src = '../COMMON/img/icon/BP/BP-First.svg';
        this.props.bpimages['RB-Second'] = new Image();
        this.props.bpimages['RB-Second'].src = '../COMMON/img/icon/BP/RB-Second.svg';
        this.props.bpimages['BB-Second'] = new Image();
        this.props.bpimages['BB-Second'].src = '../COMMON/img/icon/BP/BB-Second.svg';
        this.props.bpimages['RP-Second'] = new Image();
        this.props.bpimages['RP-Second'].src = '../COMMON/img/icon/BP/RP-Second.svg';
        this.props.bpimages['BP-Second'] = new Image();
        this.props.bpimages['BP-Second'].src = '../COMMON/img/icon/BP/BP-Second.svg';
    }

    updateView() {
        const viewRed = this.views.imgBPOrderRed;
        const viewBlue = this.views.imgBPOrderBlue;

        // With -Second icons we have many more different combinations to handle
        // Display rule: don't care who operated first, as per MFA: "连世界第一电竞都不会区分"
        // blue 1st ban === red 1st pick
        // use only the "first" icons
        const currentDispCount = this.states.firstBanTeam ? 1 : 0 + this.states.firstPickTeam ? 1 : 0;
        if (currentDispCount === 0) {
            // clear
            viewRed.src = null;
            viewBlue.src = null;
            viewRed.style.display = 'none';
            viewBlue.style.display = 'none';
            return;
        }
        else if (currentDispCount === 1) {
            // This is the "first" operation case
            if (this.states.firstBanTeam) {
                if (this.states.firstBanTeam === TEAM_RED) {
                    viewRed.src = this.props.bpimages['RB-First'].src;
                    viewBlue.src = this.props.bpimages['BP-First'].src;
                }
                else if (this.states.firstBanTeam === TEAM_BLUE) {
                    viewRed.src = this.props.bpimages['RP-First'].src;
                    viewBlue.src = this.props.bpimages['BB-First'].src;
                }
            }
            else if (this.states.firstPickTeam) {
                if (this.states.firstPickTeam === TEAM_RED) {
                    viewRed.src = this.props.bpimages['RP-First'].src;
                    viewBlue.src = this.props.bpimages['BB-First'].src;
                }
                else if (this.states.firstPickTeam === TEAM_BLUE) {
                    viewRed.src = this.props.bpimages['RB-First'].src;
                    viewBlue.src = this.props.bpimages['BP-First'].src;
                }
            }
            viewRed.style.display = 'block';
            viewBlue.style.display = 'block';

            viewRed.classList.add(this.props.animationName);
            viewBlue.classList.add(this.props.animationName);
        }
        else if (currentDispCount === 2) {
            // Do not change
        }

        return;
        

        // handle first ban / first pick display for both teams
        
        if (this.states.firstBanTeam === TEAM_RED) {
            viewRed.src = this.props.bpimages['RB'].src;
            viewBlue.src = this.props.bpimages['BP'].src;
            viewRed.style.display = 'block';
            viewBlue.style.display = 'block';
        }
        else if (this.states.firstBanTeam === TEAM_BLUE) {
            viewRed.src = this.props.bpimages['RP'].src;
            viewBlue.src = this.props.bpimages['BB'].src;
            viewRed.style.display = 'block';
            viewBlue.style.display = 'block';
        }
        else {
            // clear
            viewRed.src = null;
            viewBlue.src = null;
            viewRed.style.display = 'none';
            viewBlue.style.display = 'none';
        }

        viewRed.classList.remove(this.props.animationName);
        viewBlue.classList.remove(this.props.animationName);
        viewRed.classList.add(this.props.animationName);
        viewBlue.classList.add(this.props.animationName);

        viewRed.offsetWidth; // force reflow
        viewBlue.offsetWidth;
        return;
        if (this.views.labelFirstBan) {
            this.views.labelFirstBan.innerHTML =
                `<span>红队：Ban ${red.banOrder ?? '-'} / Pick ${red.pickOrder ?? '-'}；` +
                `蓝队：Ban ${blue.banOrder ?? '-'} / Pick ${blue.pickOrder ?? '-'}</span>`;
        }
    }

    setFirstBanTeam(team) {
        console.log('[BPOrderStore] setFirstBanTeam called with:', team);
        if (team !== TEAM_RED && team !== TEAM_BLUE) return;
        const changed = this.states.firstBanTeam !== team;
        this.states.firstBanTeam = team;
        this.states.matchStageTeams.A = team;
        this.states.matchStageTeams.B = team === TEAM_RED ? TEAM_BLUE : TEAM_RED;
        this.states.matchStageTeams.C = this.states.matchStageTeams.B
        this.states.matchStageTeams.D = this.states.matchStageTeams.A
        this.storeFirstBanTeam(team);
        this.updateView();
        this.notifyFirstBanUpdate();
        if (changed) {
            console.log('[BPOrderStore] First ban team updated to:', team);
        }
        return changed;
    }

    setFirstPickTeam(team) {
        this.setFirstBanTeam(team === TEAM_RED ? TEAM_BLUE : TEAM_RED);
        this.states.firstPickTeam = team;
        this.storeFirstPickTeam(team);
        return;
        console.log('[BPOrderStore] setFirstPickTeam called with:', team);
        if (team !== TEAM_RED && team !== TEAM_BLUE) return;
        const changed = this.states.firstPickTeam !== team;
        this.states.firstPickTeam = team;
        this.states.matchStageTeams.C = team;
        this.states.matchStageTeams.D = team === TEAM_RED ? TEAM_BLUE : TEAM_RED;
        this.storeFirstPickTeam(team);
        this.updateView();
        if (changed) {
            console.log('[BPOrderStore] First pick team updated to:', team);
        }
        return changed;
    }

    // legacy-compatible clear for also first pick
    clearFirstBanTeam() {
        this.states.firstBanTeam = null;
        this.states.firstPickTeam = null;
        this.states.matchStageTeams['A'] = null;
        this.states.matchStageTeams['B'] = null;
        this.states.matchStageTeams['C'] = null;
        this.states.matchStageTeams['D'] = null;
        this.updateView();
    }

    getFirstBanTeam() {
        return this.states.firstBanTeam;
    }

    clearFirstPickTeam() {
        this.states.firstPickTeam = null;
        this.states.matchStageTeams['C'] = null;
        this.states.matchStageTeams['D'] = null;
        this.updateView();
    }

    getFirstPickTeam() {
        return this.states.firstPickTeam;
    }

    resolveMatchStageTeam(stage) {
        if (!['A', 'B', 'C', 'D'].includes(stage)) {
            console.warn('Invalid match stage:', stage);
            return null;
        }
        return this.states.matchStageTeams[stage];
    }

    resolveStageTeams() {
        return this.states.matchStageTeams;
    }

    onFirstBanUpdate(callback) {
        if (typeof callback === 'function') {
            this.props.firstBanUpdateCallbacks.push(callback);
        }
    }
    
    notifyFirstBanUpdate() {
        for (const callback of this.props.firstBanUpdateCallbacks) {
            try {
                callback(this.states.firstBanTeam);
            } catch (e) {
                console.error('Error in first ban update callback:', e);
            }
        }
    }

    clearFirstBanUpdateListeners() {
        this.props.firstBanUpdateCallbacks = [];
    }

    // since there's no way to know who banned first when pick order isn't tied to ban order
    // we have to store these and request them when needed
    storeFirstBanTeam(team) {
        if (window.localStorage) {
            try {
                localStorage.setItem('mp5_firstBanTeam', team);
            } catch (e) {
                console.error('Error storing first ban team in localStorage:', e);
            }
        }
    }

    storeFirstPickTeam(team) {
        if (window.localStorage) {
            try {
                localStorage.setItem('mp5_firstPickTeam', team);
            } catch (e) {
                console.error('Error storing first pick team in localStorage:', e);
            }
        }
    }

    loadFirstBanPickFromStorage() {
        if (window.localStorage) {
            try {
                const storedBanTeam = localStorage.getItem('mp5_firstBanTeam');
                const storedPickTeam = localStorage.getItem('mp5_firstPickTeam');
                if (storedBanTeam === TEAM_RED || storedBanTeam === TEAM_BLUE) {
                    this.setFirstBanTeam(storedBanTeam);
                }
                if (storedPickTeam === TEAM_RED || storedPickTeam === TEAM_BLUE) {
                    this.setFirstPickTeam(storedPickTeam);
                }

                this.updateView();
                this.notifyFirstBanUpdate();
            } catch (e) {
                console.error('Error loading first ban/pick team from localStorage:', e);
            }
        }
    }

    clearFirstBanPickStorage() {
        if (window.localStorage) {
            try {
                localStorage.removeItem('mp5_firstBanTeam');
                localStorage.removeItem('mp5_firstPickTeam');
            } catch (e) {
                console.error('Error clearing first ban/pick team from localStorage:', e);
            }
        }
    }
    
    reset() {
        // soft reset: keep storage and listeners
        this.clearFirstBanTeam();
    }

    hardReset() {
        this.clearFirstBanPickStorage();
        this.clearFirstBanTeam();
    }
}