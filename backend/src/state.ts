export type WinnerAnnouncement = {
  participantId: string;
  participantName: string;
  prizeName: string;
  prizeCategory: string;
  message: string;
};

let latestWinner: WinnerAnnouncement | null = null;
const gossipFeed: string[] = [];

export function getLatestWinner() {
  return latestWinner;
}

export function setLatestWinner(winner: WinnerAnnouncement | null) {
  latestWinner = winner;
}

export function addGossip(message: string) {
  gossipFeed.unshift(message);
  if (gossipFeed.length > 6) gossipFeed.pop();
}

export function getGossip() {
  return [...gossipFeed];
}
