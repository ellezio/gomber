function startGame() {
  gomber.start();
}

let gomber = {
  canvas: document.createElement("canvas"),
  wrapper: document.createElement("div"),
  start: function () {
    this.canvas.width = 1000;
    this.canvas.height = 600;
    this.canvas.style.border = "3px solid #000";
    this.canvas.style.borderRadius = "15px";

    this.wrapper.style.width = "fit-content";
    this.wrapper.style.margin = "auto";

    this.context = this.canvas.getContext("2d");

    this.wrapper.appendChild(this.canvas);
    document.body.replaceChildren(this.wrapper);
  },
};
