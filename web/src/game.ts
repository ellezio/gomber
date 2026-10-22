import { GameMap, TileType } from "./gameMap";
import { CircularBuffer } from "./buffer";
import { Bomb } from "./entities/bomb";
import { Entity } from "./entities/entity";
import { Explosion } from "./entities/explosion";
import { Player } from "./entities/player";
import { HUD } from "./hud";
import { Action, InputHandler, unprocessedInput } from "./input";
import { clients } from "./lobby";

const SCALE = 1;

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
};

type powerUpInMsg = entityInMsg;

export type boardUpdateMessage = {
  controlledEntityId: number;
  processedInput: { id: number; actions: Action[]; dt: number };
  board: {
    grid: TileType[][];
    players: playerInMsg[];
    bombs: bombInMsg[];
    explosions: entityInMsg[];
    powerups: powerUpInMsg[];
  };
};

export class Game {
  htmlElement: HTMLElement;

  hud = new HUD();

  board: GameMap;
  inputHandler = new InputHandler();
  clients: clients;

  player: Player;
  entities: Entity[] = [];
  bombs: Bomb[] = [];
  explosions: Explosion[] = [];
  powerups: Entity[] = [];

  fps = document.createElement("div");
  fc = 0;
  dtSum = 0;
  explosionDtSum = 0;

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

    this.board = new GameMap();

    window.onkeyup = window.onkeydown = this.inputHandler.handleKeyboardEvent;

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
    let input: { actions: Action[]; dt: number } | null = null;
    if (this.player.active) {
      input = this.inputHandler.currentInput(dt);
    }

    // if (this.player !== undefined && input !== null) {
    //   const command = this.inputHandler.handleInput(input);
    //   command && command(this.player);
    // }

    if (input != null) {
      const lastInput = this.inputBuffer.peekRear();
      const uinput: unprocessedInput = {
        seq: (lastInput?.seq ?? 0) + 1,
        input,
      };
      this.inputBuffer.push(uinput);

      this.onInput(uinput);
    }
  }

  private update(dt: number) {
    this.explosions.forEach((e) => e.update(dt));

    this.hud.updatePlayerStats({
      hp: this.player.hp,
      bombsCount: this.player.availableBombs,
    });
  }

  private render() {
    this.clear();

    const offX = Math.round(this.canvas.width / 2 - this.board.width / 2);
    const offY = Math.round(this.canvas.height / 2 - this.board.height / 2);

    this.ctx.translate(offX, offY);

    this.board.render(this.ctx);

    for (const entity of this.entities) {
      // if (this.player?.collision.check(entity)) {
      //   entity.color = "green";
      // } else {
      //   entity.color = "blue";
      // }

      entity.render(this.ctx, SCALE);
    }

    this.bombs.forEach((b) => b.render(this.ctx, SCALE));
    this.explosions.forEach((e) => e.render(this.ctx, SCALE));
    this.powerups.forEach((e) => e.render(this.ctx, SCALE));
    this.player?.render(this.ctx, SCALE);

    this.explosions = this.explosions.filter((ent) => ent.active);

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
        let processingInput = this.inputBuffer.pop();

        while (
          processingInput &&
          processingInput.seq != data.processedInput.id
        ) {
          processingInput = this.inputBuffer.pop();
        }

        for (const input of this.inputBuffer) {
          const command = this.inputHandler.handleInput(input.input);
          command && command(this.player);
        }

        // if (processingInput) {
        //   if (processingInput.inputId !== data.processedInput.id) {
        //     this.unprocessedInputs.length = 0;
        //     this.board.player.position.x = player.pos.x;
        //     this.board.player.position.y = player.pos.y;
        //     this.board.player.speed = player.speed;
        //   } else {
        //     if (
        //       processingInput.x !== player.pos.x ||
        //       processingInput.y !== player.pos.y ||
        //       processingInput.speed !== player.speed
        //     ) {
        //       this.board.player.position.x = player.pos.x;
        //       this.board.player.position.y = player.pos.y;
        //       this.board.player.speed = player.speed;
        //       for (const uinp of this.unprocessedInputs) {
        //         const command = this.inputHandler.handleInput(uinp.input);
        //         command && command(this.board.player);
        //       }
        //     }
        //   }
        // }
      } else {
        // const obj = this.board.entities.find(
        //   (obj) => obj.id === player.id,
        // ) as Player;
        // if (obj !== undefined) {
        //   obj.position.x = player.pos.x;
        //   obj.position.y = player.pos.y;
        //   obj.speed = player.speed;
        // } else {
        //   const newPlayer = Player.fromMessage(player);
        //   this.board.entities.push(newPlayer);
        // }
      }
    }

    this.entities = data.board.players
      .filter((p) => p.id !== data.controlledEntityId)
      .map((p) => Player.fromMessage(p));

    this.bombs =
      data.board.bombs?.map((b) => {
        const bomb = new Bomb(
          b.id,
          b.pos,
          { width: b.aabb.max.x, height: b.aabb.max.y },
          "white",
          b.active,
        );
        bomb.countDown = b.cd;
        return bomb;
      }) ?? [];

    data.board.explosions?.forEach((e) => {
      this.explosions.push(
        new Explosion(
          e.id,
          e.pos,
          { width: e.aabb.max.x, height: e.aabb.max.y },
          "yellow",
          e.active,
        ),
      );
    });

    this.powerups =
      data.board.powerups?.map((e) => {
        return new Entity(
          e.id,
          e.pos,
          { width: e.aabb.max.x, height: e.aabb.max.y },
          "purple",
          e.active,
        );
      }) ?? [];

    if (this.board.grid === undefined) {
      this.board.setGrid(data.board.grid);
    } else {
      this.board.updateGrid(data.board.grid);
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
