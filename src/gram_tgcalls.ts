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

    /**
     * Constructs a new `GramTGCalls` instance.
     * @param client Your GramJS client which will be authenticating as a user.
     * @param chat The username/ID of the chat/channel which you will be interacting with its call.
     */
    constructor(
        public client: TelegramClient,
        public chat: Api.TypeEntityLike,
    ) {
        super();

        this.client.addEventHandler(this.updateHandler.bind(this));
    }

    private async updateHandler(update: Api.TypeUpdate) {
        if (!this.instances) return;

        if (update instanceof Api.UpdateGroupCall) {
            if (update.call instanceof Api.GroupCallDiscarded) {
                if (
                    (await this.client.getPeerId(this.chat, false)) ==
                    (await this.client.getPeerId(update.chatId, false))
                ) {
                    this.instances = undefined;
                }
            }
        }
    }

    //#region stream

    /**
     * Starts streaming the provided audio and/or video with their own options in the call, if not already streaming.
     * Otherwise, replaces the current streams and updates the options.
     */
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

            const { call, groupcallDefaultJoinAs } = await getFullChat(
                this.client,
                this.chat,
            );

            if (!call) {
                throw new Error('No active call');
            }

            tgcalls.joinVoiceCall = async payload => {
                return await joinCall(this.client, call, payload, {
                    inviteHash: params.join?.inviteHash,
                    muted: params.join?.muted ?? params.audio !== undefined,
                    joinAs:
                        params.join?.joinAs ?? groupcallDefaultJoinAs ?? 'me',
                    videoStopped:
                        params.join?.videoStopped ?? params.video === undefined,
                });
            };

            await tgcalls.start(stream);

            this.instances = { tgcalls, stream, call };
        }

        if (params.audio) {
            this.instances.stream.setAudio(
                params.audio,
                params.destroyPrevious ?? true,
            );
        }

        if (params.video) {
            this.instances.stream.setVideo(
                params.video,
                params.destroyPrevious ?? true,
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

    //#region edit

    /**
     * Edits a participant of the call.
     * @param params The new parameters of the participant.
     * @param participant The identifier of the participant to edit. Defaults to self.
     * @returns Returns `true` on success or `false` if not in call.
     */
    async edit(params: EditParams, participant: Api.TypeEntityLike = 'me') {
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

    //#endregion

    /**
     * Stops streaming and leaves the call.
     * @returns Returns `true` on success or `false` if not in call.
     */
    async stop() {
        if (!this.instances) return false;

        await leaveCall(this.client, this.instances.call);
        this.instances.tgcalls.close();
        this.instances.stream.stop();
        this.instances = undefined;
        return true;
    }

    /**
     * Pauses the audio and/or video.
     * @returns Returns `true` on success, `false` if already paused and `null` if not in call.
     */
    pause() {
        return this.instances ? this.instances.stream.pause() : null;
    }

    /**
     * Resumes the audio and/or video.
     * @returns Returns `true` on success, `false` if not paused or `null` if not in call.
     */
    resume() {
        return this.instances ? this.instances.stream.resume() : null;
    }

    /**
     * Mutes the audio.
     * @returns Returns `true` on success, `false` if already muted or `null` if not in call.
     */
    mute() {
        return this.instances ? this.instances.stream.mute() : null;
    }

    /**
     * Unmutes the audio.
     * @returns Returns `true` on success, `false` if not muted or `null` if not in call.
     */
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
