# tgcalls-next

[![npm](https://img.shields.io/npm/v/tgcalls-next)](https://npm.im/tgcalls-next)

TGCalls Next is a non-official, audio-only fork of the original
[tgcallsjs](https://github.com/tgcallsjs/tgcalls), which is merged with
[gram-tgcalls](https://github.com/tgcallsjs/gram-tgcalls) to support GramJS
directly.

## Example Usage

```ts
import { createReadStream } from "fs";
import { TelegramClient } from "telegram";
import { TGCalls } from "tgcalls-next";

const client = new TelegramClient(session, {});

(async () => {
  await client.start();

  const tgcalls = new TGCalls(client, -1234567890);

  await tgcalls.stream(createReadStream("file.raw"), { ...options });
})();
```

## Required Media Properties

- Format: `s16le`
- Channels: 2
- Bitrate: 65K or what you provided in the `StreamOptions`

### Conversion w/ FFmpeg

```bash
ffmpeg -i [input] -f s16le -ac 1 -ar 65K [output]
```

> Please note that the above example is using default values of configurable
> options.
