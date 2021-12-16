import { Candidate, Conference, Ssrc, Transport } from "./types";

export class SdpBuilder {
  #lines: string[] = [];
  #newLine: string[] = [];

  get lines() {
    return this.#lines.slice();
  }

  join() {
    return this.#lines.join("\n");
  }

  finalize() {
    return this.join() + "\n";
  }

  private add(line: string) {
    this.#lines.push(line);
  }

  private push(word: string) {
    this.#newLine.push(word);
  }

  private addJoined(separator = "") {
    this.add(this.#newLine.join(separator));
    this.#newLine = [];
  }

  addCandidate(c: Candidate) {
    this.push("a=candidate:");
    this.push(
      `${c.foundation} ${c.component} ${c.protocol} ${c.priority} ${c.ip} ${c.port} typ ${c.type}`,
    );
    this.push(` generation ${c.generation}`);
    this.addJoined();
  }

  addHeader(sessionId: number) {
    this.add("v=0");
    this.add(`o=- ${sessionId} 2 IN IP4 0.0.0.0`);
    this.add("s=-");
    this.add("t=0 0");
    this.add(`a=group:BUNDLE 0`);
    this.add("a=ice-lite");
  }

  addTransport(transport: Transport) {
    this.add(`a=ice-ufrag:${transport.ufrag}`);
    this.add(`a=ice-pwd:${transport.pwd}`);

    for (let fingerprint of transport.fingerprints) {
      this.add(`a=fingerprint:${fingerprint.hash} ${fingerprint.fingerprint}`);
      this.add(`a=setup:passive`);
    }

    let candidates = transport.candidates;
    for (let candidate of candidates) {
      this.addCandidate(candidate);
    }
  }

  addSsrcEntry(transport: Transport) {
    this.add(`m=audio 1 RTP/SAVPF 111 126`);
    this.add("c=IN IP4 0.0.0.0");
    this.add(`a=mid:0`);
    this.addTransport(transport);
    this.add("a=rtpmap:111 opus/48000/2");
    this.add("a=rtpmap:126 telephone-event/8000");
    this.add("a=fmtp:111 minptime=10; useinbandfec=1; usedtx=1");
    this.add("a=rtcp:1 IN IP4 0.0.0.0");
    this.add("a=rtcp-mux");
    this.add("a=rtcp-fb:111 transport-cc");
    this.add("a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level");
    this.add("a=recvonly");
  }

  addConference(conference: Conference) {
    this.addHeader(conference.sessionId);
    this.addSsrcEntry(conference.transport);
  }

  static fromConference(conference: Conference) {
    const sdp = new SdpBuilder();
    sdp.addConference(conference);
    return sdp.finalize();
  }
}
