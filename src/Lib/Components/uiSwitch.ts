import {
  clamp,
  Color,
  Engine,
  EventEmitter,
  ExcaliburGraphicsContext,
  GameEvent,
  Graphic,
  KeyEvent,
  Keys,
  PointerEvent,
  ScreenElement,
  Sprite,
  vec,
  Vector,
} from "excalibur";
import { BaseUIConfig, IClickable, IFocusable, IHoverable, InteractiveUIComponent } from "./uiComponent";

export type UISwitchConfig = BaseUIConfig & {
  checked: boolean;
  trackRadius?: number;
  knobRadius?: number;
  colors?: {
    trackOff?: Color;
    trackOn?: Color;
    knob?: Color;
    disabled?: Color;
  };
  focusIndicator?: Vector;
  tabStopIndex?: number;
};

export type UISwitchEvents = {
  UISwitchChanged: UISwitchChanged;
  UISwitchFocused: UISwitchFocused;
  UISwitchUnfocused: UISwitchUnfocused;
  UISwitchDown: UISwitchDown;
  UISwitchUp: UISwitchUp;
  UISwitchEnabled: UISwitchEnabled;
  UISwitchDisabled: UISwitchDisabled;
  UISwitchHovered: UISwitchHovered;
  UISwitchUnhovered: UISwitchUnhovered;
};

export const DefaultSwitchConfig: UISwitchConfig = {
  name: "UISwitch",
  width: 50,
  height: 24,
  pos: vec(0, 0),
  checked: false,
  focusIndicator: vec(5, 5),
};

export class UISwitch extends InteractiveUIComponent<UISwitchConfig, UISwitchEvents> {
  protected _config: UISwitchConfig;
  protected focusPosition: Vector;
  _checked: boolean;
  _isHovered: boolean;

  constructor(config: Partial<UISwitchConfig>) {
    const localConfig: UISwitchConfig = {
      ...DefaultSwitchConfig,
      ...config,
    };

    super(localConfig);

    this.tabStopIndex = localConfig.tabStopIndex ?? -1;
    this.focusPosition = localConfig.focusIndicator;
    this._config = localConfig;
    this._checked = localConfig.checked;
    this.graphics.use(new UISwitchGraphic(this, localConfig));
    this.pointer.useGraphicsBounds = true;
  }

  onAdd(engine: Engine) {
    this.on("pointerup", this.onClick);
    this.on("pointerdown", this.onPointerDown);
    this.on("pointerenter", this.onHover);
    this.on("pointerleave", this.onUnhover);
    engine.input.keyboard.on("press", this.onKeyDown);
  }

  onRemove(engine: Engine) {
    this.off("pointerup", this.onClick);
    this.off("pointerenter", this.onHover);
    this.off("pointerleave", this.onUnhover);
    this.off("pointerdown", this.onPointerDown);
    engine.input.keyboard.off("press", this.onKeyDown);
  }

  onHover = (): void => {
    this._isHovered = true;
    this.emitter.emit("UISwitchHovered", { target: this });
  };

  onUnhover = (): void => {
    this._isHovered = false;
    this.emitter.emit("UISwitchUnhovered", { target: this });
  };

  onKeyDown = (e: KeyEvent): void => {
    if (!this.isEnabled) return;
    if (!this.isFocused) return;
    if (e.key === Keys.Space || e.key === Keys.Enter) {
      this.toggle();
    }
  };

  get isHovered() {
    return this._isHovered;
  }

  onPointerDown = (event: PointerEvent): void => {
    if (!this.isEnabled) return;
    this.emitter.emit("UISwitchDown", { target: this });
    if (this.manager) this.manager.setFocus(this);
  };

  onClick = (event: PointerEvent): void => {
    if (!this.isEnabled) return;
    this.emitter.emit("UISwitchUp", { target: this });
    this.toggle();
  };

  toggle() {
    this.checked = !this._checked;
    this.emitter.emit("UISwitchChanged", { checked: this._checked, target: this });
  }

  set checked(v: boolean) {
    if (v !== this._checked) {
      this._checked = v;
      this.emitter.emit("UISwitchChanged", { checked: this._checked, target: this });
    }
  }

  get checked() {
    return this._checked;
  }

  focus() {
    this._isFocused = true;
    this.emitter.emit("UISwitchFocused", { target: this });
  }

  loseFocus() {
    this._isFocused = false;
    this.emitter.emit("UISwitchUnfocused", { target: this });
  }

  get isFocused() {
    return this._isFocused;
  }

  setEnabled(v: boolean) {
    super.setEnabled(v);

    if (v) {
      this.emitter.emit("UISwitchEnabled", { target: this });
    } else {
      this.emitter.emit("UISwitchDisabled", { target: this });
    }
  }
}

class UISwitchGraphic extends Graphic {
  private owner: UISwitch;
  private config: UISwitchConfig;
  private cnv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  focusPosition: Vector = new Vector(0, 0);

  constructor(owner: UISwitch, config: UISwitchConfig) {
    super({ width: config.width, height: config.height });
    this.owner = owner;
    this.config = config;

    const knobRadius = config.knobRadius ?? config.height / 2 - 2;
    const padding = knobRadius + 2;

    this.cnv = document.createElement("canvas");
    this.cnv.width = config.width + padding * 2;
    this.cnv.height = config.height + padding * 2;
    this.ctx = this.cnv.getContext("2d")!;
    this.focusPosition = config.focusIndicator ?? this.focusPosition;
  }

  clone(): UISwitchGraphic {
    return new UISwitchGraphic(this.owner, this.config);
  }

  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const ctx = this.ctx;

    const knobRadius = this.config.knobRadius ?? this.config.height / 2 - 2;
    const padding = knobRadius + 2;

    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, this.cnv.width, this.cnv.height);

    // Translate context to account for padding
    ctx.save();
    ctx.translate(padding, padding);

    const isChecked = this.owner.checked;
    const trackRadius = this.config.trackRadius ?? this.config.height / 2;
    const isEnabled = this.owner.isEnabled;
    const isFocused = this.owner.isFocused;

    const colors = {
      trackOff: Color.DarkGray,
      trackOn: Color.fromHex("#4CAF50"),
      knob: Color.White,
      disabled: Color.Gray,
      ...this.config.colors,
    };

    if (!this.owner.isEnabled) {
      ctx.filter = "grayscale(100%) brightness(0.7)";
    }

    // ---- TRACK ----
    ctx.beginPath();
    ctx.fillStyle = (isChecked ? colors.trackOn : colors.trackOff).toString();
    ctx.roundRect(0, 0, this.config.width, this.config.height, trackRadius);
    ctx.fill();

    // ---- KNOB ----
    const knobPadding = 2;
    const knobX = isChecked ? this.config.width - knobRadius - knobPadding : knobRadius + knobPadding;
    const knobY = this.config.height / 2;

    ctx.beginPath();
    ctx.fillStyle = colors.knob.toString();
    ctx.strokeStyle = colors.knob.toString();
    ctx.arc(knobX, knobY, knobRadius, 0, Math.PI * 2);
    ctx.fill();

    // ---- FOCUS INDICATOR ----
    if (isFocused && isEnabled) {
      ctx.beginPath();
      ctx.fillStyle = "#000000";
      ctx.arc(this.focusPosition.x, this.focusPosition.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.filter = "none";

    this.cnv.setAttribute("forceUpload", "true");
    ex.drawImage(this.cnv, x - padding, y - padding);
  }
}

export type UISpriteSwitchConfig = BaseUIConfig & {
  checked: boolean;
  sprites: {
    trackOff: Sprite | null;
    trackOn: Sprite | null;
    knobOff: Sprite | null;
    knobOn: Sprite | null;
  };
  focusIndicator?: Vector;
  tabStopIndex?: number;
};

export const DefaultSpriteSwitchConfig: UISpriteSwitchConfig = {
  name: "UISwitch",
  width: 50,
  height: 24,
  pos: vec(0, 0),
  checked: false,
  focusIndicator: vec(5, 5),
  sprites: {
    trackOff: null,
    trackOn: null,
    knobOff: null,
    knobOn: null,
  },
};

export class UISpriteSwitch extends InteractiveUIComponent<UISpriteSwitchConfig, UISwitchEvents> {
  protected _config: UISpriteSwitchConfig;
  protected focusPosition: Vector;
  protected _checked: boolean;
  _isFocused: boolean;
  _isHovered: boolean;

  constructor(config: UISpriteSwitchConfig) {
    const localConfig: UISpriteSwitchConfig = {
      ...DefaultSpriteSwitchConfig,
      ...config,
    };

    super(localConfig);
    this.tabStopIndex = localConfig.tabStopIndex ?? -1;
    this.focusPosition = localConfig.focusIndicator;
    this._config = localConfig;
    this._checked = localConfig.checked;
    this.graphics.use(new UISpriteSwitchGraphic(this, localConfig));
    this.pointer.useGraphicsBounds = true;
  }

  onAdd(engine: Engine) {
    this.on("pointerup", this.onClick);
    this.on("pointerdown", this.onPointerDown);
    this.on("pointerenter", this.onHover);
    this.on("pointerleave", this.onUnhover);
    engine.input.keyboard.on("press", this.onKeyDown);
  }

  onRemove(engine: Engine) {
    this.off("pointerup", this.onClick);
    this.off("pointerenter", this.onHover);
    this.off("pointerleave", this.onUnhover);
    this.off("pointerdown", this.onPointerDown);
    engine.input.keyboard.off("press", this.onKeyDown);
  }

  onHover = (): void => {
    this._isHovered = true;
    this.emitter.emit("UISwitchHovered", { target: this });
  };

  onUnhover = (): void => {
    this._isHovered = false;
    this.emitter.emit("UISwitchUnhovered", { target: this });
  };

  onKeyDown = (e: KeyEvent): void => {
    if (!this.isEnabled) return;
    if (!this.isFocused) return;
    if (e.key === Keys.Space || e.key === Keys.Enter) {
      this.toggle();
    }
  };

  get isHovered() {
    return this._isHovered;
  }

  onPointerDown = (event: PointerEvent): void => {
    if (!this.isEnabled) return;
    this.emitter.emit("UISwitchDown", { target: this });
    if (this.manager) this.manager.setFocus(this);
  };

  onClick = (event: PointerEvent): void => {
    if (!this.isEnabled) return;
    this.emitter.emit("UISwitchUp", { target: this });
    this.toggle();
  };

  toggle() {
    this.checked = !this._checked;
    this.emitter.emit("UISwitchChanged", { checked: this._checked, target: this });
  }

  set checked(v: boolean) {
    if (v !== this._checked) {
      this._checked = v;
      this.emitter.emit("UISwitchChanged", { checked: this._checked, target: this });
    }
  }

  get checked() {
    return this._checked;
  }

  focus() {
    this._isFocused = true;
    this.emitter.emit("UISwitchFocused", { target: this });
  }

  loseFocus() {
    this._isFocused = false;
    this.emitter.emit("UISwitchUnfocused", { target: this });
  }

  get isFocused() {
    return this._isFocused;
  }

  setEnabled(v: boolean) {
    super.setEnabled(v);

    if (v) {
      this.emitter.emit("UISwitchEnabled", { target: this });
    } else {
      this.emitter.emit("UISwitchDisabled", { target: this });
    }
  }
}

class UISpriteSwitchGraphic extends Graphic {
  private owner: UISpriteSwitch;
  private config: UISpriteSwitchConfig;
  private cnv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  focusPosition: Vector = new Vector(0, 0);

  constructor(owner: UISpriteSwitch, config: UISpriteSwitchConfig) {
    super({ width: config.width, height: config.height });
    this.owner = owner;
    this.config = config;

    const knobSprite = config.sprites.knobOff || config.sprites.knobOn;
    const knobRadius = knobSprite ? Math.max(knobSprite.width, knobSprite.height) / 2 : 12;
    const padding = knobRadius + 2;

    this.width = config.width + padding * 2;
    this.height = config.height + padding * 2;
    this.cnv = document.createElement("canvas");
    this.cnv.width = config.width + padding * 2;
    this.cnv.height = config.height + padding * 2;
    this.ctx = this.cnv.getContext("2d")!;
    this.focusPosition = config.focusIndicator ?? this.focusPosition;
  }

  clone(): Graphic {
    return new UISpriteSwitchGraphic(this.owner, this.config);
  }

  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const ctx = this.ctx;
    const isChecked = this.owner.checked;
    const { sprites } = this.config;
    const isFocused = this.owner.isFocused;
    const isEnabled = this.owner.isEnabled;

    const knobSprite = sprites.knobOff || sprites.knobOn;
    const knobRadius = knobSprite ? Math.max(knobSprite.width, knobSprite.height) / 2 : 12;
    const padding = knobRadius + 2;

    ctx.clearRect(0, 0, this.config.width + padding * 2, this.config.height + padding * 2);

    // Translate context to account for padding
    ctx.save();
    ctx.translate(padding, padding);

    // Apply disabled filter if needed
    if (!this.owner.isEnabled) {
      ctx.filter = "grayscale(100%) brightness(0.7)";
    }

    // ---- TRACK ----
    const trackSprite = isChecked ? sprites.trackOn : sprites.trackOff;
    if (trackSprite) {
      ctx.drawImage(trackSprite.image.image, 0, 0, this.config.width, this.config.height);
    }

    // ---- KNOB ----
    const knob = isChecked ? sprites.knobOn : sprites.knobOff;
    if (knob) {
      const knobPadding = 2;
      let knobX: number;
      let knobY: number;

      if (isChecked) {
        knobX = this.config.width - knob.width - knobPadding;
      } else {
        knobX = knobPadding;
      }
      knobY = this.config.height / 2 - knob.height / 2;

      ctx.drawImage(knob.image.image, knobX, knobY);
    }

    // ---- FOCUS INDICATOR ----
    if (isFocused && isEnabled) {
      ctx.beginPath();
      ctx.fillStyle = "#000000";
      ctx.arc(this.focusPosition.x, this.focusPosition.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.filter = "none";

    this.cnv.setAttribute("forceUpload", "true");
    ex.drawImage(this.cnv, x - padding, y - padding);
  }
}

//#region events

export class UISwitchChanged extends GameEvent<UISwitch> {
  constructor(public target: UISwitch) {
    super();
  }
}

export class UISwitchFocused extends GameEvent<UISwitch> {
  constructor(public target: UISwitch) {
    super();
  }
}

export class UISwitchUnfocused extends GameEvent<UISwitch> {
  constructor(public target: UISwitch) {
    super();
  }
}

export class UISwitchEnabled extends GameEvent<UISwitch> {
  constructor(public target: UISwitch) {
    super();
  }
}

export class UISwitchDisabled extends GameEvent<UISwitch> {
  constructor(public target: UISwitch) {
    super();
  }
}

export class UISwitchDown extends GameEvent<UISwitch> {
  constructor(public target: UISwitch) {
    super();
  }
}

export class UISwitchUp extends GameEvent<UISwitch> {
  constructor(public target: UISwitch) {
    super();
  }
}

export class UISwitchHovered extends GameEvent<UISwitch> {
  constructor(public target: UISwitch) {
    super();
  }
}

export class UISwitchUnhovered extends GameEvent<UISwitch> {
  constructor(public target: UISwitch) {
    super();
  }
}

//#endregion events
