import { Api } from 'telegram';

export interface AudioOptions {
    bps: number;
    bitrate: number;
    channels: number;
}

export interface VideoOptions {
    fps: number;
    width: number;
    height: number;
}

export interface Fingerprint {
    hash: string;
    fingerprint: string;
}

export interface Transport {
    ufrag: string;
    pwd: string;
    fingerprints: Fingerprint[];
    candidates: Candidate[];
}

export interface Conference {
    sessionId: number;
    transport: Transport;
    ssrcs: Ssrc[];
}

export interface Candidate {
    generation: string;
    component: string;
    protocol: string;
    port: string;
    ip: string;
    foundation: string;
    id: string;
    priority: string;
    type: string;
    network: string;
}

export interface Ssrc {
    ssrc: number;
    ssrc_group: number[];
}

export interface Sdp {
    fingerprint: string | null;
    hash: string | null;
    setup: string | null;
    pwd: string | null;
    ufrag: string | null;
    source: number | null;
    sourceGroup: number[] | null;
}

export interface JoinVoiceCallParams<T> {
    ufrag: string;
    pwd: string;
    hash: string;
    setup: 'active';
    fingerprint: string;
    source: number;
    sourceGroup: number[];
    params: T;
}

export interface JoinVoiceCallResponse {
    transport: Transport | null;
}

export type JoinVoiceCallCallback<T> = (
    payload: JoinVoiceCallParams<T>,
) => Promise<JoinVoiceCallResponse>;

//#region gram-tgcalls

export interface JoinParams {
    muted: boolean;
    inviteHash?: string;
    videoStopped: boolean;
    joinAs: Api.TypeEntityLike;
}

export interface EditParams {
    muted?: boolean;
    volume?: number;
    raiseHand?: boolean;
    videoStopped?: boolean;
    presentationPaused?: boolean;
}

//#endregion
