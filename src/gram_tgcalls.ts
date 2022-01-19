import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { Api, TelegramClient } from 'telegram';
import { TGCalls } from './tgcalls';
import { Stream } from './stream';
import { AudioOptions, EditParams, JoinParams, VideoOptions } from './types';
import { editParticipant, getFullChat, joinCall, leaveCall } from './utils';

export declare interface GramTGCalls {
    on(event: 'finish', listener: () => void): this;
    on(event: 'audio-finish', listener: () => void): this;
    on(event: 'video-finish', listener: () => void): this;
    on(event: 'audio-error', listener: (err: unknown) => void): this;
    on(event: 'video-error', listener: (err: unknown) => void): this;
    on(event: string, listener: Function): this;
}

export class GramTGCalls extends EventEmitter {
    private instances?: {
        tgcalls: TGCalls<null>;
        stream: Stream;
        call: Api.TypeInputGroupCall;
    };

    constructor(
        public client: TelegramClient,
        public chat: Api.TypeEntityLike,
    ) {
        super();

        this.client.addEventHandler(this.updateHandler.bind(this));
    }

    private updateHandler(update: Api.TypeUpdate) {
        if (!this.instances) return;

        if (update instanceof Api.UpdateGroupCall) {
            if (update.call instanceof Api.GroupCallDiscarded) {
                if (this.instances.call.id.equals(update.call.id)) {
                    this.instances = undefined;
                }
            }
        }
    }

    //#region stream

    async stream(params: {
        audio?: Readable;
        video?: Readable;
        lipSync?: boolean;
        destroyPrevious?: boolean;
        audioOptions?: AudioOptions;
        videoOptions?: VideoOptions;
        join?: Partial<JoinParams>;
    }) {
        if (!params.audio && !params.video) {
            throw new Error('Provide at least one readable');
        }

        if (!this.instances) {
            const stream = new Stream(params.lipSync);

            stream.on('finish', () => this.emit('finish'));
            stream.on('audio-finish', () => this.emit('audio-finish'));
            stream.on('video-finish', () => this.emit('video-finish'));

            stream.on('audio-error', err => this.emit('audio-error', err));

            stream.on('video-error', err => this.emit('video-error', err));

            const tgcalls = new TGCalls(null);

            let call: Api.InputGroupCall;

            tgcalls.joinVoiceCall = async payload => {
                const fullChat = await getFullChat(this.client, this.chat);

                if (!fullChat.call) {
                    throw new Error('No active call');
                }

                call = fullChat.call;

                return await joinCall(this.client, call, payload, {
                    joinAs:
                        params.join?.joinAs ??
                        fullChat.groupcallDefaultJoinAs ??
                        'me',
                    videoStopped:
                        params.join?.videoStopped ?? params.video !== undefined,
                    inviteHash: params.join?.inviteHash,
                    muted: params.join?.muted ?? params.audio !== undefined,
                });
            };

            await tgcalls.start(stream);

            this.instances = { tgcalls, stream, call: call! };
        }

        if (params.audio) {
            this.instances.stream.setAudio(
                params.audio,
                params.destroyPrevious,
            );
        }

        if (params.video) {
            this.instances.stream.setVideo(
                params.video,
                params.destroyPrevious,
            );
        }

        if (params.audioOptions) {
            this.instances.stream.audioOptions = params.audioOptions;
        }

        if (params.videoOptions) {
            this.instances.stream.videoOptions = params.videoOptions;
        }
    }

    //#endregion

    //#region editParticipant

    async editParticipant(
        params: EditParams,
        participant: Api.TypeEntityLike = 'me',
    ) {
        if (!this.instances) {
            return false;
        }

        await editParticipant(
            this.client,
            this.instances.call,
            participant,
            params,
        );
        return true;
    }

    edit = this.editParticipant;

    //#endregion

    async stop() {
        if (!this.instances) return false;

        await leaveCall(this.client, this.instances.call);
        this.instances.tgcalls.close();
        this.instances.stream.stop();
        this.instances = undefined;
        return true;
    }

    pause() {
        return this.instances ? this.instances.stream.pause() : null;
    }

    resume() {
        return this.instances ? this.instances.stream.resume() : null;
    }

    mute() {
        return this.instances ? this.instances.stream.mute() : null;
    }

    unmute() {
        return this.instances ? this.instances.stream.unmute() : null;
    }

    get finished() {
        return this.instances ? this.instances.stream.finished : null;
    }

    get stopped() {
        return this.instances ? this.instances.stream.stopped : null;
    }
}
