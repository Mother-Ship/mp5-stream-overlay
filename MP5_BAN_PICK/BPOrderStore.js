const TEAM_RED = 'Red';
const TEAM_BLUE = 'Blue';

export class BPOrderStore {
    views = {
    };
    states = {
        firstBanTeam: null,
        matchStageTeams: {
            A: null,
            B: null,
        }
    };
    props = {
        firstBanUpdateCallbacks: [],
    }

    constructor(views) {
        this.views = views;
    }

    updateView() {
        if (this.states.firstBanTeam === TEAM_RED) {
            this.views.btnFirstBanRed.classList.add('button-active');
            this.views.btnFirstBanRed.classList.remove('button-inactive');
            this.views.btnFirstBanBlue.classList.add('button-inactive');
            this.views.btnFirstBanBlue.classList.remove('button-active');
        }
        else if (this.states.firstBanTeam === TEAM_BLUE) {
            this.views.btnFirstBanRed.classList.add('button-inactive');
            this.views.btnFirstBanRed.classList.remove('button-active');
            this.views.btnFirstBanBlue.classList.add('button-active');
            this.views.btnFirstBanBlue.classList.remove('button-inactive');
        }
        else {
            this.views.btnFirstBanRed.classList.add('button-inactive');
            this.views.btnFirstBanRed.classList.remove('button-active');
            this.views.btnFirstBanBlue.classList.add('button-inactive');
            this.views.btnFirstBanBlue.classList.remove('button-active');
        }
    }

    setFirstBanTeam(team) {
        if (team !== TEAM_RED && team !== TEAM_BLUE) {
            console.warn('Invalid team for first ban:', team);
            return;
        }
        let isAnUpdate = false;
        if (this.states.firstBanTeam !== team) {
            isAnUpdate = true;
        }
        this.states.firstBanTeam = team;
        this.updateView();

        this.states.matchStageTeams['A'] = team === TEAM_RED ? TEAM_RED : TEAM_BLUE;
        this.states.matchStageTeams['B'] = team === TEAM_RED ? TEAM_BLUE : TEAM_RED;

        return isAnUpdate;
    }

    clearFirstBanTeam() {
        this.states.firstBanTeam = null;
        this.states.matchStageTeams['A'] = null;
        this.states.matchStageTeams['B'] = null;
        this.updateView();
    }

    getFirstBanTeam() {
        return this.states.firstBanTeam;
    }

    getCurrentMatchStageTeams() {
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
}