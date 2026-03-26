import { getTeamFullInfoByName } from "../lib/bracket.js";

export class ChatRenderer {
    views = {
        chatContainer: null,
    };
    states = {
        teams: {
            left: null,
            right: null,
        },
        players: {
            left: null,
            right: null,
        },
        messages: [],
    };
    props = {
    }

    constructor(views) {
        this.views = views;
    }

    async updateTeams(teams) {
        if (!teams.left || !teams.right) {
            this.states.teams.left = null;
            this.states.teams.right = null;
            console.warn('ChatRenderer: Missing team information, unable to update teams.');
        }
        else {
            this.states.teams.left = teams.left;
            this.states.teams.right = teams.right;

            let leftPlayers, rightPlayers;

            try { 
                leftPlayers = (await getTeamFullInfoByName(teams.left)).Players;
                rightPlayers = (await getTeamFullInfoByName(teams.right)).Players;
            }
            catch (e) {
                console.error('ChatRenderer: Error fetching team information:', e);
                this.states.players.left = [];
                this.states.players.right = [];
                return;
            }
            
            if (!leftPlayers || !rightPlayers) {
                console.warn('ChatRenderer: Unable to fetch player information for teams:', teams);
                this.states.players.left = [];
                this.states.players.right = [];
            }
            else {
                this.states.players.left = leftPlayers.map(player => player.Username);
                this.states.players.right = rightPlayers.map(player => player.Username);
            }
        }

        this.renderChatMessages(this.states.messages, true);
        console.log('[ChatRenderer] Updated teams:', this.states.teams, 'and players:', this.states.players);
    }

    renderChatMessages(messages, forceUpdate = false) {
        if (forceUpdate) {
            this.views.chatContainer.innerHTML = '';
            this.states.messages = [];
        }

        const newMessages = messages.slice(this.states.messages.length);
        this.states.messages.push(...newMessages);

        for (const message of newMessages) {
            const messageElement = document.createElement('p');
            
            let teamClass = 'unknown-chat';
            if (this.states.players.left && this.states.players.left.includes(message.name)) {
                teamClass = 'player-a-name-chat';
            }
            else if (this.states.players.right && this.states.players.right.includes(message.name)) {
                teamClass = 'player-b-name-chat';
            }

            messageElement.innerHTML = `<span class="time">${message.time}&nbsp;</span> <span class="${teamClass}">${message.name}:&nbsp;</span>${message.messageBody}`;
            this.views.chatContainer.appendChild(messageElement);
            this.views.chatContainer.scrollTop = this.views.chatContainer.scrollHeight;

            console.log(`[ChatRenderer] New message from ${message.name}: ${message.messageBody}, team: ${teamClass}`);
        }
    }
}