export type ParticipantStatus = 'INACTIVE' | 'ACTIVE' | 'WON';

export type Participant = {
  id: string;
  name: string;
  status: ParticipantStatus;
  hasWon?: boolean;
  role: 'EMPLOYEE' | 'INTERN';
  createdAt: string;
  activatedAt?: string | null;
  invitationUrl?: string;
  qrCode?: string;
};

export type Prize = {
  id: string;
  name: string;
  category: 'MINOR' | 'MAJOR';
  description: string;
  remaining: number;
};

export type HostPayload = {
  event: {
    id: string;
    name: string;
    status: string;
    currentRound: number;
  };
  participants: Participant[];
  prizes: Prize[];
  winner?: {
    participantId: string;
    participantName: string;
    prizeName: string;
    prizeCategory: string;
    message: string;
  } | null;
  gossip: string[];
  publicAddress: {
    url: string;
    isLocal: boolean;
    mode: 'wifi' | 'public' | 'local';
  };
};

export type GuestPayload = {
  valid: boolean;
  status?: 'activated' | 'already' | 'invalid' | 'already-won';
  message: string;
  participant?: {
    name: string;
  };
};
