export class CircularBuffer<T> {
  private buf: Array<T | undefined>;
  private cap: number;
  private front: number;
  private rear: number;

  constructor(cap: number) {
    this.cap = cap + 1;
    this.buf = Array<T>(this.cap);
  }

  push(item: T): boolean {
    if (this.isFull()) {
      return false;
    }
    this.buf[this.rear] = item;
    this.rear = (this.rear + 1) % this.cap;
    return true;
  }

  pop(): T | null {
    if (this.isEmpty()) {
      return null;
    }
    const item = this.buf[this.front]!;
    this.buf[this.front] = undefined;
    this.front = (this.front + 1) % this.cap;
    return item;
  }

  peekFront(): T | null {
    if (this.isEmpty()) {
      return null;
    }
    return this.buf[this.front]!;
  }

  peekRear(): T | null {
    if (this.isEmpty()) {
      return null;
    }
    return this.buf[this.rear]!;
  }

  isEmpty(): boolean {
    return this.rear === this.front;
  }

  isFull(): boolean {
    return (this.rear + 1) % this.cap === this.front;
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let ptr = this.front; ptr != this.rear; ptr = (ptr + 1) % this.cap) {
      yield this.buf[ptr]!;
    }
  }
}
