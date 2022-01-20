# tgcalls-next

[![npm](https://img.shields.io/npm/v/tgcalls-next)](https://npm.im/tgcalls-next)

TGCalls Next is a non-official fork of the original
[tgcallsjs](https://github.com/tgcallsjs/tgcalls), which is merged with
[gram-tgcalls](https://github.com/tgcallsjs/gram-tgcalls) to support GramJS
directly.

## Documentation

The documentation is available at <https://tgcalls-next.github.io/tgcalls>.

## Example Usage

```ts
import { createReadStream } from "fs";
import { TelegramClient } from "telegram";
import { TGCalls, Stream } from "tgcalls-next";

const client = new TelegramClient(session, 0, "", {});

(async () => {
  await client.start();

  const tgcalls = new TGCalls(client, -1234567890);
  const stream = new Stream({ audio: createReadStream("audio.raw"), video: createReadStream("video.raw"), ... })

  await tgcalls.stream(stream);
})();
```

## Required Media Properties

# Audio

-   Format: `s16le`
-   Channels: 1
-   Bitrate: 65K or what you provided in the `StreamOptions`

# Video

-   Format: `rawvideo`
-   Dimensions: min 640x360, max 1280x720
-   FPS: min 24, max 30

### Conversion w/ FFmpeg

# Audio

```bash
ffmpeg -i [input] -f s16le -ac 1 -ar 65K [output]
```

# Video

```bash
ffmpeg -i [input] -f rawvideo -r 24 -vf scale=640:-1 [output]
```

# Both

```bash
ffmpeg -i [input video with sound] -f rawvideo -r 24 -vf scale=640:-1 [video output] -f s16le -ac 1 -ar 65K [audio output]
```

> Please note that the above commands are using default values of configurable
> options.
