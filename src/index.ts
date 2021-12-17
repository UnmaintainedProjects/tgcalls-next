import { Api, TelegramClient } from 'telegram';
import { Readable } from 'stream';
import { BaseTGCalls, Stream } from './base_tgcalls';
import { editParticipant, getFullChat, joinCall, leaveCall } from './utils';
import { EditParams, JoinParams, Listeners } from './types';

export class TGCalls {
    private call?: Api.InputGroupCall;
    private tgcalls?: BaseTGCalls<any>;
    private _stream?: Stream;
    private track?: MediaStreamTrack;

    constructor(
        public client: TelegramClient,
        public chat: Api.TypeEntityLike,
    ) {
        this.client.addEventHandler(this.updateHandler);
    }

    private updateHandler(update: Api.TypeUpdate) {
        if (update instanceof Api.UpdateGroupCall) {
            if (update.call instanceof Api.GroupCallDiscarded) {
                this.close();
                this.reset();
            }
        }
    }

    /**
     * Starts streaming the provided medias with their own options.
     *
     * @param readable The readable to stream
     * @param opts Options
     */
    async stream(
        readable?: Readable,
        opts?: {
            joinParams?: JoinParams;
            listeners?: Listeners;
            bitsPerSample?: number;
            sampleRate?: number;
            channelCount?: number;
            almostFinishedTrigger?: number;
        },
    ) {
        if (!this.tgcalls) {
            this.tgcalls = new BaseTGCalls({});
            this.tgcalls.joinVoiceCall = async payload => {
                const fullChat = await getFullChat(this.client, this.chat);

                if (!fullChat.call) {
                    throw new Error('No active call');
                }

                this.call = fullChat.call;

                return await joinCall(this.client, this.call, payload, {
                    ...opts?.joinParams,
                    joinAs:
                        opts?.joinParams?.joinAs ||
                        fullChat.groupcallDefaultJoinAs,
                });
            };
        }

        if (!this._stream) {
            this._stream = new Stream(readable, {
                ...opts,
            });

            this.track = this._stream.createTrack();

            if (opts?.listeners?.onError) {
                this._stream.on('error', opts.listeners.onError);
            }

            if (opts?.listeners?.onFinish) {
                this._stream.on('finish', opts.listeners.onFinish);
            }
        } else {
            this._stream?.setReadable(readable);
            return;
        }

        try {
            await this.tgcalls.start(this.track);
        } catch (err) {
            this.reset();
            throw err;
        }
    }

    /**
     * Pauses the stream. Returns `null` if there is not in call, `false` if already paused or `true` if successful.
     */
    pause() {
        if (!this._stream) {
            return null;
        }

        if (!this._stream.paused) {
            this._stream.pause();
            return true;
        }

        return false;
    }

    /**
     * Resumes the stream. Returns `null` if there is not in call, `false` if not paused or `true` if successful.
     */
    resume() {
        if (!this._stream) {
            return null;
        }

        if (this._stream.paused) {
            this._stream.pause();
            return true;
        }

        return false;
    }

    /**
     * Mutes the stream. Returns `null` if there is not in call, `false` if already muted or `true` if successful.
     */
    mute() {
        if (!this.track) {
            return null;
        }

        if (this.track.enabled) {
            this.track.enabled = false;
            return true;
        }

        return false;
    }

    /**
     * Unmutes the stream. Returns `null` if not in call, `false` if already muted or `true` if successful.
     */
    unmute() {
        if (!this.track) {
            return null;
        }

        if (!this.track.enabled) {
            this.track.enabled = true;
            return true;
        }

        return false;
    }

    private close() {
        this._stream?.stop();
        this.tgcalls?.close();
    }

    private reset() {
        this.call = this.tgcalls = this.track = this.track = undefined;
    }

    /**
     * Stops the streams, closes the WebRTC connection, sends leave request to Telegram and frees up resources. Returns `false` if not in call or `true` if successful.
     */
    async stop() {
        if (!this.call) {
            return false;
        }

        this._stream?.stop();
        this.close();
        await leaveCall(this.client, this.call);
        this.reset();
        return true;
    }

    /**
     * Tells if the audio has finished streaming. Returns `null` if not in call, `true` if finished or `false` if not.
     */
    get finished() {
        if (!this._stream) {
            return null;
        }

        return this._stream.finished;
    }

    /**
     * Tells if the stream was stopped. Returns `null` if not in call, `true` if stopped or `false` if not.
     */
    get stopped() {
        if (!this._stream) {
            return null;
        }

        return this._stream.stopped;
    }

    /**
     * Edits a participant.
     *
     * @param params New params for the participant
     * @param participant The participant to edit (Which will be you if not passed.)
     */
    async editParticipant(
        params: EditParams,
        participant: Api.TypeEntityLike = 'me',
    ) {
        if (!this.call) {
            return false;
        }

        await editParticipant(this.client, this.call, participant, params);
        return true;
    }

    /**
     * Alias for `edit`
     */
    edit = this.editParticipant;
}
