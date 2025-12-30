import { Board, TileType } from "./board";
import { Bomb } from "./entities/bomb";
import { Entity } from "./entities/entity";
import { Player } from "./entities/player";
import { Action, InputHandler, unprocessedInput } from "./input";
import { clients, lobbyState } from "./lobby";
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

type ServerMessage =
  | boardUpdateMessage
  | {
      type: "lobbyState";
      details: lobbyState;
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

  unprocessedInputs: unprocessedInput[] = [];
  conn: WebSocket;
  updateRate = 30;
  lastTs: number;

  updateInterval: number;

  async start() {
    this.playerList = new PlayerList(this, 0, 1);
    this.board = new Board(1000, 600, 200, this.inputHandler);
    this.playerInfo = new PlayerInfo(650, 1);
    this.playerInfo.ctx = this.board.ctx;
    this.playerList.ctx = this.board.ctx;

    this.populateDOM();

    // this.conn = new WebSocket(`ws://${location.host}/connectplayer`);
    // this.conn.onmessage = this.handleMessage.bind(this);

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

        // if (data.processedInput === null) continue;

        const processingInput = this.unprocessedInputs.shift();
        this.board.player.updateFromMessage(player);
        // if (processingInput !== undefined) {
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
        new Entity(
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
    wrapper.appendChild(this.board.canvas);
    document.body.replaceChildren(wrapper);
    document.body.appendChild(this.fps);
  }

  private update() {
    const nowTs = +new Date();
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
      const actions = this.inputHandler.getAction();
      input = actions.length > 0 ? { actions, dt } : null;
    }
    this.board.update(input);
    this.playerInfo.update();
    this.playerList.update();

    this.explosionDtSum += dt;
    if (this.explosionDtSum >= 0.3) {
      this.explosionDtSum = 0;
      this.board.explosions = [];
    }

    if (input != null) {
      const last_uinp =
        this.unprocessedInputs[this.unprocessedInputs.length - 1];
      const uinp: unprocessedInput = {
        inputId: (last_uinp?.inputId ?? 0) + 1,
        x: this.board.player.position.x,
        y: this.board.player.position.y,
        speed: this.board.player.speed,
        input,
      };
      this.unprocessedInputs.push(uinp);
      this.conn.send(
        JSON.stringify({
          id: uinp.inputId,
          actions: uinp.input.actions,
          dt: uinp.input.dt,
        }),
      );
    }
  }

  renderResult(winner: string) {
    clearInterval(this.updateInterval);

    this.board.ctx.fillStyle = "#404040";
    this.board.ctx.fillRect(
      0,
      0,
      this.board.canvas.width,
      this.board.canvas.height,
    );

    this.board.ctx.fillStyle = "black";
    this.board.ctx.font = "48px serif";
    this.board.ctx.textAlign = "center";
    this.board.ctx.textBaseline = "middle";
    if (winner != undefined) {
      this.board.ctx.fillText(
        "winner",
        this.board.canvas.width / 2,
        this.board.canvas.height / 2 - 24,
      );

      this.board.ctx.fillText(
        winner,
        this.board.canvas.width / 2,
        this.board.canvas.height / 2 + 24,
      );
    } else {
      this.board.ctx.fillText(
        "draw",
        this.board.canvas.width / 2,
        this.board.canvas.height / 2,
      );
    }
  }
}
