import { EventEmitter } from 'events';
import { RTCPeerConnection } from 'wrtc';

import { SdpBuilder } from './sdp_builder';
import { JoinVoiceCallCallback } from './types';
import { parseSdp } from './utils';
import { Stream } from './stream';

export class TGCalls<T> extends EventEmitter {
    #connection?: RTCPeerConnection;
    #params: T;

    joinVoiceCall?: JoinVoiceCallCallback<T>;

    constructor(params: T) {
        super();
        this.#params = params;
    }

    async start(stream: Stream): Promise<void> {
        if (this.#connection) {
            throw new Error('Already started');
        } else if (!this.joinVoiceCall) {
            throw new Error(
                'Please set the `joinVoiceCall` callback before calling `start()`',
            );
        }

        this.#connection = new RTCPeerConnection();
        this.#connection.oniceconnectionstatechange = async () => {
            this.emit(
                'iceConnectionState',
                this.#connection?.iceConnectionState,
            );

            switch (this.#connection?.iceConnectionState) {
                case 'closed':
                case 'failed':
                    this.emit('hangUp');
                    break;
            }
        };

        this.#connection.addTrack(stream.audioTrack);
        this.#connection.addTrack(stream.videoTrack);

        const offer = await this.#connection.createOffer({
            offerToReceiveVideo: true,
            offerToReceiveAudio: true,
        });

        await this.#connection.setLocalDescription(offer);

        if (!offer.sdp) {
            return;
        }

        const { ufrag, pwd, hash, fingerprint, source, sourceGroup } = parseSdp(
            offer.sdp,
        );

        if (
            !ufrag ||
            !pwd ||
            !hash ||
            !fingerprint ||
            !source ||
            !sourceGroup
        ) {
            return;
        }

        let joinVoiceCallResult;

        try {
            joinVoiceCallResult = await this.joinVoiceCall({
                ufrag,
                pwd,
                hash,
                setup: 'active',
                fingerprint,
                source,
                sourceGroup,
                params: this.#params,
            });
        } catch (error) {
            this.close();
            throw error;
        }

        if (!joinVoiceCallResult || !joinVoiceCallResult.transport) {
            this.close();
            throw new Error('No transport found');
        }

        const sessionId = Date.now();
        const conference = {
            sessionId,
            transport: joinVoiceCallResult.transport,
            ssrcs: [{ ssrc: source, ssrc_group: sourceGroup }],
        };

        await this.#connection.setRemoteDescription({
            type: 'answer',
            sdp: SdpBuilder.fromConference(conference),
        });
        stream.start();
    }

    close() {
        this.#connection?.close();
        this.#connection = undefined;
    }
}
