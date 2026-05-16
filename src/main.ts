// main.ts
import { UIButton } from "./Lib/Components";
import "./style.css";

import { Engine, DisplayMode, vec } from "excalibur";

const game = new Engine({
  width: 800, // the width of the canvas
  height: 600, // the height of the canvas
  displayMode: DisplayMode.Fixed, // the display mode
  pixelArt: true,
});

await game.start();

game.add(
  new UIButton({
    name: "myButton",
    idleText: "Click Me",
    pos: vec(100, 100),
    width: 100,
    height: 50,
  }),
);

let camera = game.currentScene.camera;
camera.zoom = 1.5;
