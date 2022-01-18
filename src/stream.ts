import { Readable } from 'stream';
import { EventEmitter } from 'events';
import { nonstandard, RTCAudioSource, RTCVideoSource } from 'wrtc';

import { AudioOptions, VideoOptions } from './types';

export declare interface Stream {
    on(event: 'finish', listener: () => void): this;
    on(event: 'finish-audio', listener: () => void): this;
    on(event: 'finish-video', listener: () => void): this;
    on(event: 'error', listener: (err: unknown) => void): this;
    on(event: string, listener: Function): this;
}

export class Stream extends EventEmitter {
    //#region audio

    private audioBuffer: Buffer;
    private readonly audioSource: RTCAudioSource;
    public readonly audioTrack: MediaStreamTrack;
    public audioOptions: AudioOptions;

    private audioFinished = false;
    private audioFinishedLoading = false;
    private audioPassedBytes = 0;

    //#endregion

    //#region video

    private videoBuffer: Buffer;
    private readonly videoSource: RTCVideoSource;
    public readonly videoTrack: MediaStreamTrack;
    public videoOptions: VideoOptions;

    private videoFinished = false;
    private videoFinishedLoading = false;
    private videoPassedBytes = 0;

    //#endregion

    //#region constructor

    constructor(public lipSync = false) {
        super();

        this.audioBuffer = Buffer.alloc(0);
        this.audioSource = new nonstandard.RTCAudioSource();
        this.audioTrack = this.audioSource.createTrack();
        this.audioOptions = {
            bps: 16,
            bitrate: 65000,
            channels: 1,
        };

        this.videoBuffer = Buffer.alloc(0);
        this.videoSource = new nonstandard.RTCVideoSource();
        this.videoTrack = this.videoSource.createTrack();
        this.videoOptions = {
            fps: 24,
            width: 640,
            height: 360,
        };
    }

    //#endregion

    //#region start

    private _started = false;

    get started() {
        return this._started;
    }

    start() {
        if (this.started) {
            throw new Error('Already started');
        }

        this._started = true;
        this.processAudio();
        this.processVideo();
    }

    //#endregion

    //#region stop
    private _stopped = false;

    get stopped() {
        return this._stopped;
    }

    // Cannot start again after stopping.
    stop() {
        this._stopped = true;
    }
    //#endregion

    //#region finish

    get finished() {
        return this.audioFinished && this.videoFinished;
    }

    private finish() {
        if (this.finished) {
            this.emit('finish');
        }
    }

    //#endregion

    //#region pause

    private _paused = false;

    get paused() {
        return this._paused;
    }

    pause() {
        if (this.paused) {
            return false;
        }

        this._paused = true;
        return true;
    }

    resume() {
        if (!this.paused) {
            return false;
        }

        this._paused = false;
        return true;
    }

    //#endregion

    //#region audio

    private audioReadable?: Readable;

    private audioDataListener = ((data: any) => {
        this.audioBuffer = Buffer.concat([this.audioBuffer, data]);
    }).bind(this);

    private audioEndListener = (() => {
        this.audioFinishedLoading = true;
    }).bind(this);

    setAudio(readable: Readable, destroyPrevious = true) {
        if (this.stopped) {
            throw new Error('Cannot set audio when stopped');
        }

        if (this.audioReadable) {
            this.audioReadable.removeListener('data', this.audioDataListener);
            this.audioReadable.removeListener('end', this.audioEndListener);

            if (destroyPrevious) {
                this.audioReadable.destroy();
            }
        }

        this.audioFinished = false;
        this.audioFinishedLoading = false;
        this.audioPassedBytes = 0;

        this.audioReadable = readable;
        this.audioReadable.addListener('data', this.audioDataListener);
        this.audioReadable.addListener('end', this.audioEndListener);
    }

    removeAudio(destroy = true) {
        if (this.audioReadable) {
            this.audioReadable.removeListener('data', this.audioDataListener);
            this.audioReadable.removeListener('end', this.audioEndListener);

            if (destroy) {
                this.audioReadable.destroy();
            }

            return true;
        }

        return false;
    }

    private get audioByteLength() {
        return (
            ((this.audioOptions.bitrate * this.audioOptions.bps) / 8 / 100) *
            this.audioOptions.channels
        );
    }

    private get audioNeedsTime() {
        if (this.audioFinishedLoading) {
            return false;
        }

        return this.audioBuffer.length < this.audioByteLength * 50;
    }

    mute() {
        if (!this.audioTrack.enabled) {
            return false;
        }

        this.audioTrack.enabled = false;
        return true;
    }

    unmute() {
        if (this.audioTrack.enabled) {
            return false;
        }

        this.audioTrack.enabled = true;
        return true;
    }

    private get audioNeededTime() {
        return this.audioFinished ||
            this.paused ||
            this.audioNeedsTime ||
            this.audioReadable === undefined
            ? 500
            : 10;
    }

    private get audioTime() {
        if (this.audioReadable === undefined || this.audioFinished) {
            return undefined;
        }

        return Math.ceil(
            this.audioPassedBytes /
                this.audioByteLength /
                (0.0001 / this.audioNeededTime),
        );
    }

    private audioDiff(): [boolean, number] {
        if (this.lipSync && this.videoTime !== undefined && !this.paused) {
            const time = this.audioTime;
            const videoTime = this.videoTime;

            if (time !== undefined && videoTime !== undefined) {
                if (time > videoTime) {
                    return [true, (time - videoTime) * 10000];
                } else if (this.videoNeedsTime && videoTime > time) {
                    return [true, 0];
                }
            }
        }

        return [false, 0];
    }

    //#endregion

    //#region video

    private videoReadable?: Readable;

    private videoDataListener = ((data: any) => {
        this.videoBuffer = Buffer.concat([this.videoBuffer, data]);
    }).bind(this);

    private videoEndListener = (() => {
        this.videoFinishedLoading = true;
    }).bind(this);

    setVideo(readable: Readable, destroyPrevious = true) {
        if (this.stopped) {
            throw new Error('Cannot set video when stopped');
        }

        if (this.videoReadable) {
            this.videoReadable.removeListener('data', this.videoDataListener);
            this.videoReadable.removeListener('end', this.videoEndListener);

            if (destroyPrevious) {
                this.videoReadable.destroy();
            }
        }

        this.videoFinished = false;
        this.videoFinishedLoading = false;
        this.videoPassedBytes = 0;

        this.videoReadable = readable;
        this.videoReadable.addListener('data', this.videoDataListener);
        this.videoReadable.addListener('end', this.videoEndListener);
    }

    removeVideo(destroy = true) {
        if (this.videoReadable) {
            this.videoReadable.removeListener('data', this.videoDataListener);
            this.videoReadable.removeListener('end', this.videoEndListener);

            if (destroy) {
                this.videoReadable.destroy();
            }

            return true;
        }

        return false;
    }

    private get videoByteLength() {
        return 1.5 * this.videoOptions.width * this.videoOptions.height;
    }

    private get videoNeedsTime() {
        if (this.videoFinishedLoading) {
            return false;
        }

        return this.videoBuffer.length < this.videoByteLength * 0.3;
    }

    private get videoNeededTime() {
        return this.videoFinished ||
            this.paused ||
            this.videoNeedsTime ||
            this.videoReadable === undefined
            ? 500
            : 10;
    }

    private get videoTime() {
        if (this.videoReadable === undefined || this.videoFinished) {
            return undefined;
        }

        return Math.ceil(
            this.videoPassedBytes /
                this.videoByteLength /
                (0.0001 / this.videoNeededTime),
        );
    }

    private videoDiff(): [boolean, number] {
        if (this.lipSync && this.audioTime !== undefined && !this.paused) {
            const time = this.videoTime;
            const audioTime = this.audioTime;

            if (time !== undefined && audioTime !== undefined) {
                if (time > audioTime) {
                    return [true, (time - audioTime) * 10000];
                } else if (this.audioNeedsTime && audioTime > time) {
                    return [true, 0];
                }
            }
        }

        return [false, 0];
    }

    //#endregion

    //#region process

    private processAudio() {
        if (this.stopped) {
            return;
        }

        const [needsTime, diff] = this.audioDiff();
        const ms = this.audioNeededTime - diff;

        if (
            !this.paused &&
            !this.audioFinished &&
            !needsTime &&
            (this.audioBuffer.length >= this.audioByteLength ||
                this.audioFinishedLoading) &&
            !this.audioNeedsTime
        ) {
            const buffer = this.audioBuffer.slice(0, this.audioByteLength);

            this.audioBuffer = this.audioBuffer.slice(this.audioByteLength);

            const samples = new Int16Array(new Uint8Array(buffer).buffer);

            try {
                this.audioSource.onData({
                    samples,
                    bitsPerSample: this.audioOptions.bps,
                    sampleRate: this.audioOptions.bitrate,
                    channelCount: this.audioOptions.channels,
                });
            } catch (err) {
                this.emit('error', err);
            }
        }

        if (
            !this.audioFinished &&
            this.audioFinishedLoading &&
            this.audioBuffer.length < this.audioByteLength
        ) {
            this.audioFinished = true;
            this.emit('finish-audio');
            this.finish();
        }

        setTimeout(() => this.processAudio(), ms > 0 ? ms : 0);
    }

    private processVideo() {
        if (this.stopped) {
            return;
        }

        const [needsTime, diff] = this.videoDiff();
        const ms = this.videoNeededTime - diff;

        if (
            !this.paused &&
            !this.videoFinished &&
            !needsTime &&
            (this.videoBuffer.length >= this.videoByteLength ||
                this.videoFinishedLoading) &&
            !this.videoNeedsTime
        ) {
            const buffer = this.videoBuffer.slice(0, this.videoByteLength);

            this.videoBuffer = this.videoBuffer.slice(this.videoByteLength);

            const data = new Uint8ClampedArray(buffer);

            try {
                this.videoSource.onFrame({
                    data,
                    width: this.videoOptions.width,
                    height: this.videoOptions.height,
                });
            } catch (err) {
                this.emit('error', err);
            }
        }

        if (
            !this.videoFinished &&
            this.videoFinishedLoading &&
            this.videoBuffer.length < this.videoByteLength
        ) {
            this.videoFinished = true;
            this.emit('finish-video');
            this.finish();
        }

        setTimeout(() => this.processVideo(), ms > 0 ? ms : 0);
    }

    //#endregion
}
