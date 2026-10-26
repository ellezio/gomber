import { GameMap, SCALE, TileType } from "./gameMap";
import { CircularBuffer } from "./buffer";
import { Bomb } from "./entities/bomb";
import { Entity } from "./entities/entity";
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

type bombInMsg = entityInMsg & {
  cd: number;
  er: number;
};

type powerUpInMsg = entityInMsg;

export type boardUpdateMessage = {
  controlledEntityId: number;
  processedInput: { id: number; actions: Action[]; dt: number };
  board: {
    grid: TileType[][];
    players: playerInMsg[];
    bombs: bombInMsg[];
    powerups: powerUpInMsg[];
  };
};

export class Game {
  htmlElement: HTMLElement;

  hud = new HUD();

  gameMap: GameMap;
  inputController = new InputController();
  remoteController = new RemotePlayerController();
  clients: clients;

  player: Player;
  players: Player[] = [];
  bombs: Bomb[] = [];
  explosions: Explosion[] = [];
  powerups: Entity[] = [];

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
      1000 / this.updateRate,
    );
  }

  private gameLoop() {
    const dt = this.calcDeltatime();
    this.updateFPS(dt);
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
    if (!this.player.active) return;

    const input = this.inputController.currentInput(dt);

    if (input != null) {
      if (this.player !== undefined) {
        this.inputController.handleInput(input, this.player);
        checkPlayerCollision(this.player, this.gameMap, this.bombs);
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
      while (this.networkTickAccTime >= this.networkTickTime) {
        this.networkTickAccTime -= this.networkTickTime;
      }

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
    this.players.forEach((p) => this.remoteController.update(p, dt));
    this.bombs.forEach((b) => b.update(dt));
    this.explosions.forEach((e) => e.update(dt));

    this.bombs.forEach((b) => entityVsEntities(b, this.explosions));

    this.bombs = this.bombs.filter((b) => b.active);
    this.explosions = this.explosions.filter((e) => e.active);

    this.hud.updatePlayerStats({
      hp: this.player.hp,
      bombsCount: this.player.availableBombs,
    });
  }

  private render() {
    this.clear();

    const offX = Math.round(this.canvas.width / 2 - this.gameMap.width / 2);
    const offY = Math.round(this.canvas.height / 2 - this.gameMap.height / 2);

    this.ctx.translate(offX, offY);

    this.gameMap.render(this.ctx);

    for (const player of this.players) {
      player.render(this.ctx, SCALE);
    }

    this.bombs.forEach((b) => b.render(this.ctx, SCALE));
    this.explosions.forEach((e) => e.render(this.ctx, SCALE));
    this.powerups.forEach((e) => e.render(this.ctx, SCALE));
    this.player?.render(this.ctx, SCALE);

    this.ctx.translate(-offX, -offY);
    this.hud.render(this.ctx);
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

  public handleMessage(data: boardUpdateMessage) {
    this.players = this.players.filter((p) =>
      data.board.players.find((bp) => p.id == bp.id),
    );

    for (const player of data.board.players) {
      if (player.id == data.controlledEntityId) continue;

      const existingPlayer = this.players.find((p) => p.id == player.id);
      if (existingPlayer) {
        existingPlayer.updateFromMessage(player);
      } else {
        this.players.push(Player.fromMessage(player));
      }
    }

    for (const bomb of data.board.bombs ?? []) {
      const exists = this.bombs.find((b) => b.id == bomb.id);
      if (!exists) {
        const newBomb = new Bomb(
          this,
          bomb.id,
          bomb.pos,
          { width: bomb.aabb.max.x, height: bomb.aabb.max.y },
          "white",
          bomb.active,
        );
        newBomb.countDown = bomb.cd;
        newBomb.explosionRange = bomb.er;
        this.bombs.push(newBomb);
      }
    }

    this.powerups =
      data.board.powerups?.map((e) => {
        return new Entity(
          this,
          e.id,
          e.pos,
          { width: e.aabb.max.x, height: e.aabb.max.y },
          "purple",
          e.active,
        );
      }) ?? [];

    if (this.gameMap.grid === undefined) {
      this.gameMap.setGrid(data.board.grid);
    } else {
      this.gameMap.updateGrid(data.board.grid);
    }

    for (const player of data.board.players) {
      if (player.id === data.controlledEntityId) {
        if (this.player === undefined) {
          this.player = Player.fromMessage(player);
          this.hud.updatePlayerStats({
            hp: this.player.hp,
            bombsCount: this.player.availableBombs,
          });
        }

        if (data.processedInput === null) {
          this.player.updateStatsFromMessage(player);
          continue;
        }

        this.player.updateFromMessage(player);
        // there is no need for interpolating current player because it's movement is predicted
        this.player.position = { ...this.player.serverPosition };

        let processingInput = this.inputBuffer.pop();

        while (
          processingInput &&
          processingInput.seq != data.processedInput.id
        ) {
          processingInput = this.inputBuffer.pop();
        }

        for (const input of this.inputBuffer) {
          this.inputController.handleInput(input.input, this.player);
          checkPlayerCollision(this.player, this.gameMap, this.bombs);
        }

        if (this.networkInput.actions.length > 0) {
          this.inputController.handleInput(this.networkInput, this.player);
          checkPlayerCollision(this.player, this.gameMap, this.bombs);
        }
      }
    }
  }

  instantiate(entity: Entity) {
    if (entity instanceof Explosion) {
      this.explosions.push(entity);
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
