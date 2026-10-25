class Parameter {
  value = 0;
  events: { kind: string; value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "set", value, time });
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "ramp", value, time });
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.linearRampToValueAtTime(value, time);
  }
  setTargetAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ kind: "target", value, time });
  }
  cancelScheduledValues() {}
  cancelAndHoldAtTime() {}
}
class Node {
  connections: Node[] = [];
  gain = new Parameter();
  frequency = new Parameter();
  detune = new Parameter();
  Q = new Parameter();
  type = "";
  startAt: number | null = null;
  stopAt: number | null = null;
  onended: (() => void) | null = null;
  connect(node: Node) {
    this.connections.push(node);
    return node;
  }
  disconnect() {
    this.connections = [];
  }
  start(time: number) {
    this.startAt = time;
  }
  stop(time: number) {
    this.stopAt = time;
  }
}
export class Context {
  currentTime = 10;
  state = "running";
  destination = new Node();
  oscillators: Node[] = [];
  gains: Node[] = [];
  analyser: Node | null = null;
  closed = false;
  resume: () => Promise<void> = async () => {
    this.state = "running";
  };
  createOscillator() {
    const node = new Node();
    this.oscillators.push(node);
    return node;
  }
  createGain() {
    const node = new Node();
    this.gains.push(node);
    return node;
  }
  createBiquadFilter() {
    return new Node();
  }
  createDynamicsCompressor() {
    return new Node();
  }
  createAnalyser() {
    this.analyser = new Node();
    return this.analyser;
  }
  async close() {
    this.state = "closed";
    this.closed = true;
  }
}
