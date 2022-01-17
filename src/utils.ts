import { Sdp } from './types';

export function parseSdp(sdp: string): Sdp {
    const lines = sdp.split('\r\n');

    const lookup = (prefix: string) => {
        for (let line of lines) {
            if (line.startsWith(prefix)) {
                return line.substring(prefix.length);
            }
        }
        return null;
    };

    const rawAudioSource = lookup('a=ssrc:');
    const rawVideoSource = lookup('a=ssrc-group:FID ');

    return {
        fingerprint: lookup('a=fingerprint:')?.split(' ')[1] ?? null,
        hash: lookup('a=fingerprint:')?.split(' ')[0] ?? null,
        setup: lookup('a=setup:'),
        pwd: lookup('a=ice-pwd:'),
        ufrag: lookup('a=ice-ufrag:'),
        source: rawAudioSource ? Number(rawAudioSource.split(' ')[0]) : null,
        sourceGroup: rawVideoSource
            ? rawVideoSource.split(' ').map(Number)
            : null,
    };
}
