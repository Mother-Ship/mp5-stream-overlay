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
        bpimages: {
            'RB': null,
            'BB': null,
            'RP': null,
            'BP': null,
        },
        animationName: 'bp-order-fade-in',
    }

    constructor(views) {
        this.views = views;

        // prefetch images
        this.props.bpimages['RB'] = new Image();
        this.props.bpimages['RB'].src = '../COMMON/img/icon/BP/RB.svg';
        this.props.bpimages['BB'] = new Image();
        this.props.bpimages['BB'].src = '../COMMON/img/icon/BP/BB.svg';
        this.props.bpimages['RP'] = new Image();
        this.props.bpimages['RP'].src = '../COMMON/img/icon/BP/RP.svg';
        this.props.bpimages['BP'] = new Image();
        this.props.bpimages['BP'].src = '../COMMON/img/icon/BP/BP.svg';
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

        // handle first ban / first pick display for both teams
        const viewRed = this.views.imgBPOrderRed;
        const viewBlue = this.views.imgBPOrderBlue;
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