import { Board, TileType } from "./board";
import { CircularBuffer } from "./buffer";
import { Bomb } from "./entities/bomb";
import { Entity } from "./entities/entity";
import { Explosion } from "./entities/explosion";
import { Player } from "./entities/player";
import { Action, InputHandler, unprocessedInput } from "./input";
import { clients } from "./lobby";
import { PlayerInfo } from "./playerInfo";
import { PlayerList } from "./playersList";

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
  playerList: PlayerList;
  playerInfo: PlayerInfo;
  board: Board;
  inputHandler = new InputHandler();
  clients: clients;

  fps = document.createElement("div");
  fc = 0;
  dtSum = 0;
  explosionDtSum = 0;

  updateRate = 60;
  lastTs: number;

  inputBuffer = new CircularBuffer<unprocessedInput>(60);

  updateInterval: number;

  canvas = document.createElement("canvas");
  ctx = this.canvas.getContext("2d");

  onInput: (input: unprocessedInput) => void;

  async start() {
    this.canvas.width = 1000;
    this.canvas.height = 600;
    this.canvas.style.border = "3px solid #000";

    this.playerList = new PlayerList(this, 0, 1);
    this.board = new Board(200, this.inputHandler);
    this.playerInfo = new PlayerInfo(650, 1);

    this.populateDOM();

    window.onkeyup = window.onkeydown = this.inputHandler.handleKeyboardEvent;

    this.updateInterval = window.setInterval(
      () => this.update(),
      1000 / this.updateRate,
    );
  }

  public handleMessage(data: boardUpdateMessage) {
    for (const player of data.board.players) {
      if (player.id === data.controlledEntityId) {
        if (this.board.player === undefined) {
          this.board.player = Player.fromMessage(player);
          this.playerInfo.player = this.board.player;
        }

        if (data.processedInput === null) {
          this.board.player.updateStatsFromMessage(player);
          continue;
        }

        this.board.player.updateFromMessage(player);
        let processingInput = this.inputBuffer.pop();

        while (
          processingInput &&
          processingInput.seq != data.processedInput.id
        ) {
          processingInput = this.inputBuffer.pop();
        }

        for (const input of this.inputBuffer) {
          if (!input) break;
          const command = this.inputHandler.handleInput(input.input);
          command && command(this.board.player);
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

    this.board.entities = data.board.players
      .filter((p) => p.id !== data.controlledEntityId)
      .map((p) => Player.fromMessage(p));

    this.board.bombs =
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
      this.board.explosions.push(
        new Explosion(
          e.id,
          e.pos,
          { width: e.aabb.max.x, height: e.aabb.max.y },
          "yellow",
          e.active,
        ),
      );
    });

    this.board.powerups =
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

  private populateDOM() {
    const wrapper = document.createElement("div");
    wrapper.style.width = "fit-content";
    wrapper.style.margin = "auto";
    wrapper.appendChild(this.canvas);
    document.body.replaceChildren(wrapper);
    document.body.appendChild(this.fps);
  }

  private update() {
    this.clear();

    const nowTs = performance.now();
    const lastTs = this.lastTs || nowTs;
    const dt = (nowTs - lastTs) / 1000;
    this.lastTs = nowTs;

    this.dtSum += dt;
    if (this.dtSum >= 1) {
      this.fps.innerHTML = this.fc + " fps";
      this.dtSum = 0;
      this.fc = 0;
    } else {
      this.fc++;
    }

    let input: { actions: Action[]; dt: number } | null = null;
    if (this.board.player.active) {
      input = this.inputHandler.currentInput(dt);
    }

    this.board.update(this.ctx, input, dt);
    this.playerInfo.update(this.ctx);
    this.playerList.update(this.ctx);

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
