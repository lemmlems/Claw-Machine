export type WinnerAnnouncement = {
  participantId: string;
  participantName: string;
  prizeName: string;
  prizeCategory: string;
  message: string;
};

export type ClawSettings = {
  prizeCategory: 'MINOR' | 'MAJOR';
  minorInternsOnly: boolean;
};

let latestWinner: WinnerAnnouncement | null = null;
const gossipFeed: string[] = [];
let clawSettings: ClawSettings = {
  prizeCategory: 'MINOR',
  minorInternsOnly: false,
};

export function getLatestWinner() {
  return latestWinner;
}

export function setLatestWinner(winner: WinnerAnnouncement | null) {
  latestWinner = winner;
}

export function getClawSettings(): ClawSettings {
  return { ...clawSettings };
}

export function setClawSettings(next: Partial<ClawSettings>): ClawSettings {
  const prizeCategory = next.prizeCategory === 'MAJOR'
    ? 'MAJOR'
    : next.prizeCategory === 'MINOR'
      ? 'MINOR'
      : clawSettings.prizeCategory;
  const minorInternsOnly = prizeCategory === 'MAJOR'
    ? false
    : typeof next.minorInternsOnly === 'boolean'
      ? next.minorInternsOnly
      : clawSettings.minorInternsOnly;
  clawSettings = { prizeCategory, minorInternsOnly };
  return getClawSettings();
}

export function addGossip(message: string) {
  gossipFeed.unshift(message);
  if (gossipFeed.length > 6) gossipFeed.pop();
}

export function getGossip() {
  return [...gossipFeed];
}
