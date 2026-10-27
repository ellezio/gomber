import { GameMap, SCALE, TileType } from "./gameMap";
import { CircularBuffer } from "./buffer";
import { Bomb } from "./entities/bomb";
import { Entity, powerUpFromMessage } from "./entities/entity";
import { Explosion } from "./entities/explosion";
import { Player } from "./entities/player";
import { HUD } from "./hud";
import {
  Action,
  input,
  InputController,
  RemotePlayerController,
  unprocessedInput,
} from "./input";
import { clients } from "./lobby";
import { entityVsEntities, checkPlayerCollision } from "./collision";

type entityInMsg = {
  id: number;
  pos: { x: number; y: number };
  aabb: { min: { x: number; y: number }; max: { x: number; y: number } };
  active: boolean;
  name: string;
};

export type playerInMsg = entityInMsg & {
  speed: number;
  maxBombs: number;
  availableBombs: number;
  hp: number;
};

export type bombInMsg = entityInMsg & {
  cd: number;
  er: number;
};

export type powerUpInMsg = entityInMsg;

export type gameUpdateMessage = {
  controlledEntityId: number;
  processedInput: { id: number; actions: Action[]; dt: number };
  board: {
    grid: TileType[][];
    players: playerInMsg[];
    bombs: bombInMsg[];
    powerups: powerUpInMsg[];
  };
};

class GameState {
  player: Player;
  players: Player[] = [];
  bombs: Bomb[] = [];
  explosions: Explosion[] = [];
  powerups: Entity[] = [];
}

export class Game {
  htmlElement: HTMLElement;

  hud = new HUD();

  gameMap: GameMap;
  inputController = new InputController();
  remoteController = new RemotePlayerController();
  clients: clients;

  // may be in future this will be buffer over update messages that
  // the client will try to catch up to. But for now it will be
  // just the newest update message from server.
  pendingServerState: gameUpdateMessage;
  state = new GameState();

  fps = document.createElement("div");
  fc = 0;
  dtSum = 0;
  explosionDtSum = 0;

  networkTickTime = 1 / 60;
  networkTickAccTime = 0;
  networkInput = { actions: [], dt: 0 } as input;
  networkInputLastSeqNum = 0;

  // round up for accepting floating number inaccuracy
  serverSimDT = Math.ceil(1 / 60);

  updateRate = 60;
  lastTs: number;

  inputBuffer = new CircularBuffer<unprocessedInput>(60);

  updateInterval: number;

  canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  ctx = this.canvas.getContext("2d");

  onInput: (input: unprocessedInput) => void;

  async start() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = width;
    this.canvas.height = height;

    this.hud.updateResolution(width, height);

    this.gameMap = new GameMap();

    window.onkeyup = window.onkeydown =
      this.inputController.handleKeyboardEvent;

    this.updateInterval = window.setInterval(
      this.gameLoop.bind(this),
      // this results with integer so the precision in case 60 fps
      // where dt is 16.666666 ms is truncated to 16 ms
      1000 / this.updateRate,
    );
  }

  private gameLoop() {
    const dt = this.calcDeltatime();
    this.updateFPS(dt);
    this.applyServerState();
    this.handleInput(dt);
    this.update(dt);
    this.render();
  }

  private calcDeltatime(): number {
    const nowTs = performance.now();
    const lastTs = this.lastTs || nowTs;
    const dt = (nowTs - lastTs) / 1000;
    this.lastTs = nowTs;
    return dt;
  }

  private updateFPS(dt: number) {
    this.dtSum += dt;
    if (this.dtSum >= 1) {
      this.fps.innerHTML = this.fc + " fps";
      this.dtSum = 0;
      this.fc = 0;
    } else {
      this.fc++;
    }
  }

  private handleInput(dt: number) {
    if (!this.state.player.active) return;

    const input = this.inputController.currentInput(dt);

    if (input != null) {
      if (this.state.player !== undefined) {
        this.inputController.handleInput(input, this.state.player);
        checkPlayerCollision(this.state.player, this.gameMap, this.state.bombs);
      }

      this.networkInput.dt += dt;
      for (const action of input?.actions ?? []) {
        if (!this.networkInput.actions.includes(action)) {
          this.networkInput.actions.push(action);
        }
      }
    }

    this.networkTickAccTime += dt;
    if (this.networkTickAccTime >= this.networkTickTime) {
      this.networkTickAccTime %= this.networkTickTime;

      const netInput = structuredClone(this.networkInput);
      if (input) {
        // Note:
        // This needs change because it extends current input for next frame
        // additionally by the time of next input. I am thinking about some
        // compound input that will be send with same input seq as next one
        // and on server will be processed as separately within same simulation
        // tick. I am not sure what to do right now I have to look into it and
        // see how game engines solve similar problems.
        netInput.dt -= this.networkTickAccTime;
        this.networkInput.dt = this.networkTickAccTime;
        this.networkInput.actions = [...input.actions];
      } else {
        this.networkInput = { dt: 0, actions: [] };
      }

      while (netInput.dt > 0.000001) {
        this.networkInputLastSeqNum += 1;
        let uinput: unprocessedInput = {
          seq: this.networkInputLastSeqNum,
          input: structuredClone(netInput),
        };

        uinput.input.dt = Math.min(netInput.dt, this.serverSimDT);
        netInput.dt -= this.serverSimDT;

        this.inputBuffer.push(uinput);

        this.onInput(uinput);
      }
    }
  }

  private update(dt: number) {
    this.state.players.forEach((p) => this.remoteController.update(p, dt));
    this.state.bombs.forEach((b) => b.update(dt));
    this.state.explosions.forEach((e) => e.update(dt));

    this.state.bombs.forEach((b) => entityVsEntities(b, this.state.explosions));

    this.state.bombs = this.state.bombs.filter((b) => b.active);
    this.state.explosions = this.state.explosions.filter((e) => e.active);

    this.hud.updatePlayerStats({
      hp: this.state.player.hp,
      bombsCount: this.state.player.availableBombs,
    });
  }

  private render() {
    this.clear();

    const offX = Math.round(this.canvas.width / 2 - this.gameMap.width / 2);
    const offY = Math.round(this.canvas.height / 2 - this.gameMap.height / 2);

    this.ctx.translate(offX, offY);

    this.gameMap.render(this.ctx);

    for (const player of this.state.players) {
      player.render(this.ctx, SCALE);
    }

    this.state.bombs.forEach((b) => b.render(this.ctx, SCALE));
    this.state.explosions.forEach((e) => e.render(this.ctx, SCALE));
    this.state.powerups.forEach((e) => e.render(this.ctx, SCALE));
    this.state.player?.render(this.ctx, SCALE);

    this.ctx.translate(-offX, -offY);
    this.hud.render(this.ctx);
  }

  private applyServerState() {
    if (this.pendingServerState) {
      const pstate = this.pendingServerState;

      this.state.players = this.state.players.filter((p) =>
        pstate.board.players.find((bp) => p.id == bp.id),
      );

      for (const player of pstate.board.players) {
        if (player.id == pstate.controlledEntityId) continue;

        const existingPlayer = this.state.players.find(
          (p) => p.id == player.id,
        );
        if (existingPlayer) {
          existingPlayer.updateFromMessage(player);
        } else {
          this.state.players.push(Player.fromMessage(player));
        }
      }

      for (const bomb of pstate.board.bombs ?? []) {
        const exists = this.state.bombs.find((b) => b.id == bomb.id);
        if (!exists) {
          this.state.bombs.push(Bomb.fromMessage(bomb, this));
        }
      }

      this.state.bombs
        .filter((b) => !pstate.board.bombs.find((bb) => bb.id == b.id))
        .forEach((b) => b.explode());

      this.state.powerups =
        pstate.board.powerups?.map(powerUpFromMessage) ?? [];

      if (this.gameMap.grid === undefined) {
        this.gameMap.setGrid(pstate.board.grid);
      } else {
        this.gameMap.updateGrid(pstate.board.grid);
      }

      for (const player of pstate.board.players) {
        if (player.id === pstate.controlledEntityId) {
          if (this.state.player === undefined) {
            this.state.player = Player.fromMessage(player);
            this.hud.updatePlayerStats({
              hp: this.state.player.hp,
              bombsCount: this.state.player.availableBombs,
            });
          }

          if (pstate.processedInput === null) {
            this.state.player.updateStatsFromMessage(player);
            continue;
          }

          this.state.player.updateFromMessage(player);
          // there is no need for interpolating current player because it's movement is predicted
          this.state.player.position = { ...this.state.player.serverPosition };

          let processingInput = this.inputBuffer.pop();

          while (
            processingInput &&
            processingInput.seq != pstate.processedInput.id
          ) {
            processingInput = this.inputBuffer.pop();
          }

          for (const input of this.inputBuffer) {
            this.inputController.handleInput(input.input, this.state.player);
            checkPlayerCollision(
              this.state.player,
              this.gameMap,
              this.state.bombs,
            );
          }

          if (this.networkInput.actions.length > 0) {
            this.inputController.handleInput(
              this.networkInput,
              this.state.player,
            );
            checkPlayerCollision(
              this.state.player,
              this.gameMap,
              this.state.bombs,
            );
          }
        }
      }

      this.pendingServerState = null;
    }
  }

  public updateClients(clients: clients) {
    this.clients = clients;
    this.hud.updatePlayersList(
      clients.map((c) => ({
        name: c.name,
        hp: 0,
        latency: c.latency,
      })),
    );
  }

  public handleMessage(data: gameUpdateMessage) {
    this.pendingServerState = data;
  }

  instantiate(entity: Entity) {
    if (entity instanceof Explosion) {
      this.state.explosions.push(entity);
    }
  }

  renderResult(winner: string) {
    clearInterval(this.updateInterval);

    this.clear();

    this.ctx.fillStyle = "black";
    this.ctx.font = "48px serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    if (winner != undefined) {
      this.ctx.fillText(
        "winner",
        this.canvas.width / 2,
        this.canvas.height / 2 - 24,
      );

      this.ctx.fillText(
        winner,
        this.canvas.width / 2,
        this.canvas.height / 2 + 24,
      );
    } else {
      this.ctx.fillText("draw", this.canvas.width / 2, this.canvas.height / 2);
    }
  }

  private clear() {
    this.ctx.fillStyle = "#404040";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
