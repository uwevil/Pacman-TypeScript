import { PowerPill } from "./PowerPill";
import { Direction } from "./Direction";
import { DirectionChoices } from "./DirectionChoices";
import { MainWindow } from "./MainWindow";
import { Tile } from "./Tile";
import { TileContent } from "./TileContent";

import { LoopingTimer, Canvas, Sprite, Point, Vector2D, GameContext } from "../Core/_exports";

export class Maze extends Sprite {
    private static readonly footballPitchGreen = "#287848";           // solid – hides maze walls
    private static readonly footballPitchGreenDark = "#1F6035";        // alternate stripe
    private static readonly footballPitchLine = "rgba(255,255,255,0.92)";

    // the point where the ghost goes to just before going into chase/scatter mode
    static readonly tileHouseEntrance = Tile.fromIndex(new Point(13.5, 11));

    static readonly pixelHouseEntrancePoint = Tile.toCenterCanvas(new Vector2D(13.5, 11).toPoint());

    private static readonly spritesheetSize = new Vector2D(224, 248);

    // the point where the ghost goes to before going up and out of the house
    static readonly pixelCenterOfHouse = Tile.toCenterCanvas(new Vector2D(13.5, 14).toPoint());

    private static readonly specialIntersections: Point[] = [
        new Point(12, 11),
        new Point(15, 11),
        new Point(12, 26),
        new Point(15, 26)
    ];

    private static readonly powerPillPositions: Point[] = [
        new Point(2, 4),
        new Point(27, 4),
        new Point(2, 24),
        new Point(27, 24)
    ];

    private readonly _timer: LoopingTimer;

    private readonly _originalImage: HTMLImageElement;
    private readonly _directionChoices = new DirectionChoices();

    private _powerPill: PowerPill;
    private _flashing: boolean;
    private _offScreenCanvases: Canvas[];
    private _whiteMazeCanvas: Canvas;

    private _tickTock: boolean = true;

    constructor() {
        super();
        this._powerPill = new PowerPill();
        this._timer = new LoopingTimer(250, () => this._tickTock = !this._tickTock);

        this._originalImage = document.createElement("img");
        this._originalImage.src = "img/spritesheet.png";

        this._whiteMazeCanvas = Canvas.canvasFromImage(this._originalImage, new Point(228, 0), new Vector2D(234, 248));

        this._offScreenCanvases = [];
    }

    reset() {
        this._offScreenCanvases = [];
        for (let i: number = 0; i < MainWindow.gameStats.amountOfPlayers; i++) {
            this._offScreenCanvases.push(Canvas.canvasFromImage(this._originalImage));
        }

        this.decorateFootballPitchIfNeeded();
    }

    get spriteSheetPos(): Point {
        return Point.zero;
    }

    get size(): Vector2D {
        return Maze.spritesheetSize;
    }

    get spriteSheet(): HTMLImageElement {
        return this._originalImage;
    }

    get origin(): Point {
        return Point.zero;
    }

    get position(): Point {
        return Point.zero;
    }

    // special intersections have an extra restriction 
    // ghosts can not choose to turn upwards from these tiles.
    isSpecialIntersection(cell: Point): boolean {
        return cell.equals(Maze.specialIntersections[0]) ||
            cell.equals(Maze.specialIntersections[1]) ||
            cell.equals(Maze.specialIntersections[2]) ||
            cell.equals(Maze.specialIntersections[3]);
    };

    update(gameContext: GameContext): void {
        this._timer.run(gameContext.elapsed);
        this._powerPill.update(gameContext);
    }

    draw(canvas: Canvas): void {

        if (this._flashing) {
            if (this._tickTock) {
                canvas.drawOtherCanvas2(this._whiteMazeCanvas, Point.zero);
            } else {
                canvas.drawOtherCanvas2(
                    this._offScreenCanvases[MainWindow.gameStats.currentPlayerStats.playerIndex],
                    Point.zero);
            }

            return;
        }

        this.drawPowerPills();

        canvas.drawOtherCanvas2(
            this._offScreenCanvases[MainWindow.gameStats.currentPlayerStats.playerIndex],
            Point.zero);

        //    this.drawGrid(8, 8, canvas);
    }

    drawPowerPills() {
        const isFootball = this.isFootballPitchLevel();
        Maze.powerPillPositions.forEach(p => {
            const playerStats = MainWindow.gameStats.currentPlayerStats;

            if (playerStats.levelStats.getCellContent(p.minus(Point.one)) === "*") {
                this._powerPill.position = p.multiply(8).minus(Point.four);
                const canvas = this._offScreenCanvases[playerStats.playerIndex];
                // On the football level the sprite background is black; clear to green first.
                if (isFootball) {
                    canvas.fillRect(Maze.footballPitchGreen,
                        p.multiply(8).minus(new Point(5, 5)),
                        new Vector2D(10, 10));
                }
                canvas.drawSprite(this._powerPill);
            }
        });
    }

    clearCell(cell: Point) {
        const tl = Tile.fromIndex(cell).topLeft;
        const backgroundColor = this.isFootballPitchLevel() ? Maze.footballPitchGreen : "black";
        // background for football level is always the solid base green (stripes are a visual layer only)

        this._offScreenCanvases[MainWindow.gameStats.currentPlayerStats.playerIndex]
            .fillRect(backgroundColor, tl, Vector2D.eight);
    }

    isInTunnel(point: Point) {
        if (point.y !== 14) {
            return false;
        }

        if (point.x <= 5) {
            return true;
        }

        if (point.x >= 22) {
            return true;
        }

        return false;
    }

    drawGrid(w: number, h: number, canvas: Canvas): void {
        const underlyingCanvas = canvas.underlyingCanvas;
        underlyingCanvas.beginPath();

        for (let x: number = 0; x <= underlyingCanvas.canvas.width; x += w) {
            underlyingCanvas.moveTo(x, 0);
            underlyingCanvas.lineTo(x, underlyingCanvas.canvas.height);
        }
        for (let y: number = 0; y <= underlyingCanvas.canvas.height; y += h) {
            underlyingCanvas.moveTo(0, y);
            underlyingCanvas.lineTo(underlyingCanvas.canvas.width, y);
        }

        underlyingCanvas.strokeStyle = "#ff0000";
        underlyingCanvas.stroke();
    };

    canContinueInDirection(direction: Direction, tile: Tile): boolean {

        const nextTile = tile.nextTile(direction);

        return this.isCellNotAWall(nextTile.index);
    }

    getChoicesAtCellPosition(cellPos: Point): DirectionChoices {
        this._directionChoices.clear();

        if (this.isCellNotAWall(cellPos.add(new Point(-1, 0)))) {
            this._directionChoices.set(Direction.Left);
        }
        if (this.isCellNotAWall(cellPos.add(new Point(1, 0)))) {
            this._directionChoices.set(Direction.Right);
        }
        if (this.isCellNotAWall(cellPos.add(new Point(0, -1)))) {
            this._directionChoices.set(Direction.Up);
        }
        if (this.isCellNotAWall(cellPos.add(new Point(0, 1)))) {
            this._directionChoices.set(Direction.Down);
        }

        return this._directionChoices;
    }

    isCellNotAWall(cell: Point): boolean {
        return this.getTileContent(cell) !== TileContent.Wall;
    }

    startFlashing() {
        this._flashing = true;
    }

    stopFlashing() {
        this._flashing = false;
    }

    getTileContent(cell: Point): TileContent {

        const a = MainWindow.gameStats.currentPlayerStats.levelStats.getCellContent(cell);

        if (a === " ") {
            return TileContent.Wall;
        }

        if (a === "o") {
            return TileContent.Pill;
        }

        if (a === "*") {
            return TileContent.PowerPill;
        }

        if (a === "+") {
            return TileContent.Nothing;
        }

        return TileContent.Nothing;
        //throw new RangeError("Cell at ${cell.x}, ${cell.y} contained '${a}' - don't know what this is!");
    };

    getTopLeftCanvasPosition(cellPosition: Point): Point {
        return cellPosition.multiply(8);
    };

    highlightCell(canvas: Canvas, cell: Point, color: string): void {
        const topLeft = this.getTopLeftCanvasPosition(cell);
        canvas.fillRect(color, topLeft.minus(Point.one), new Vector2D(9, 9));
    }

    //todo: use clamp
    constrainCell(cell: Point): Point {

        let x = cell.x;
        let y = cell.y;

        x = x < 0 ? 0 : x;
        x = x > MazeBounds.dimensions.x ? MazeBounds.dimensions.x : x;

        y = y < 0 ? 0 : y;
        y = y > MazeBounds.dimensions.y ? MazeBounds.dimensions.y : y;

        return new Point(x, y);
    }

    isInPillCell(index: Point): boolean {
        return this.getTileContent(index) === TileContent.Pill;
    }

    private isFootballPitchLevel(): boolean {
        const currentPlayerStats = MainWindow.gameStats.currentPlayerStats;
        if (currentPlayerStats !== undefined) {
            return currentPlayerStats.levelStats.levelNumber === 0;
        }

        // During game startup the current player can still be undefined.
        if (MainWindow.gameStats.hasPlayerStats(0)) {
            return MainWindow.gameStats.getPlayerStats(0).levelStats.levelNumber === 0;
        }

        return false;
    }

    private drawFootballPitchOverlay(targetCanvas: Canvas): void {
        const ctx = targetCanvas.underlyingCanvas;
        const W = 224;
        const H = 248;

        // Portrait: goals protrude OUTSIDE the pitch at top and bottom.
        // goalDepth=11 + 3px gap → 14 px margin above/below pitch.
        const goalDepth = 11;
        const goalW = 54;
        const sidePad = 4;
        const endPad = goalDepth + 3;  // 14 px

        const pLeft = sidePad;
        const pRight = W - sidePad;
        const pTop = endPad;
        const pBottom = H - endPad;
        const pW = pRight - pLeft;
        const pH = pBottom - pTop;
        const cx = W / 2;
        const cy = pTop + pH / 2;

        ctx.save();

        // ── Base solid green (no transparency → hides maze walls) ────────────
        ctx.fillStyle = Maze.footballPitchGreen;
        ctx.fillRect(0, 0, W, H);

        // ── Horizontal grass stripes ──────────────────────────────────────────
        const stripes = 6;
        const stripeH = pH / stripes;
        for (let i = 0; i < stripes; i++) {
            if (i % 2 === 0) {
                ctx.fillStyle = Maze.footballPitchGreenDark;
                ctx.fillRect(pLeft, pTop + i * stripeH, pW, stripeH);
            }
        }

        ctx.strokeStyle = Maze.footballPitchLine;
        ctx.lineWidth = 1.5;

        // ── Outer touchlines ──────────────────────────────────────────────────
        ctx.strokeRect(pLeft, pTop, pW, pH);

        // ── Halfway line ──────────────────────────────────────────────────────
        ctx.beginPath();
        ctx.moveTo(pLeft, cy);
        ctx.lineTo(pRight, cy);
        ctx.stroke();

        // ── Centre circle + centre spot ───────────────────────────────────────
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = Maze.footballPitchLine;
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();

        // ── Penalty areas ─────────────────────────────────────────────────────
        const penW = 110;
        const penH = 30;
        ctx.strokeRect(cx - penW / 2, pTop, penW, penH);
        ctx.strokeRect(cx - penW / 2, pBottom - penH, penW, penH);

        // ── Goal areas ────────────────────────────────────────────────────────
        const gaW = 66;
        const gaH = 14;
        ctx.strokeRect(cx - gaW / 2, pTop, gaW, gaH);
        ctx.strokeRect(cx - gaW / 2, pBottom - gaH, gaW, gaH);

        // ── Penalty spots ─────────────────────────────────────────────────────
        const penSpot = 22;
        ctx.fillStyle = Maze.footballPitchLine;
        ctx.beginPath();
        ctx.arc(cx, pTop + penSpot, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, pBottom - penSpot, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // ── Penalty arcs (toward centre of pitch) ─────────────────────────────
        ctx.beginPath();
        ctx.arc(cx, pTop + penSpot, 13, 0.35, Math.PI - 0.35);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, pBottom - penSpot, 13, Math.PI + 0.35, Math.PI * 2 - 0.35);
        ctx.stroke();

        // ── Corner arcs ───────────────────────────────────────────────────────
        const cr = 4;
        ctx.beginPath(); ctx.arc(pLeft, pTop, cr, 0, Math.PI / 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(pRight, pTop, cr, Math.PI / 2, Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(pLeft, pBottom, cr, -Math.PI / 2, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(pRight, pBottom, cr, Math.PI, Math.PI * 3 / 2); ctx.stroke();

        // ── Goals outside the pitch ───────────────────────────────────────────
        this.drawGoalWithNet(ctx, cx, pTop, goalW, goalDepth, true);
        this.drawGoalWithNet(ctx, cx, pBottom, goalW, goalDepth, false);

        ctx.restore();
    }

    /** Draws one goal frame + net, protruding outside the pitch end-line. */
    private drawGoalWithNet(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        endLineY: number,
        goalWidth: number,
        goalDepth: number,
        isTop: boolean): void {

        const gLeft = centerX - goalWidth / 2;
        const gRight = centerX + goalWidth / 2;
        // The far edge goes OUTSIDE the canvas boundary but canvas clips it.
        const gFar = isTop ? endLineY - goalDepth : endLineY + goalDepth;

        const yMin = Math.min(endLineY, gFar);
        const yMax = Math.max(endLineY, gFar);

        // Net background tint
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.fillRect(gLeft, yMin, goalWidth, goalDepth);

        ctx.save();

        // ── Goal frame: 3 sides, white, thick ─────────────────────────────────
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(gLeft, endLineY);
        ctx.lineTo(gLeft, gFar);
        ctx.lineTo(gRight, gFar);
        ctx.lineTo(gRight, endLineY);
        ctx.stroke();

        // ── Net grid ──────────────────────────────────────────────────────────
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = "rgba(255,255,255,0.50)";
        ctx.beginPath();
        for (let y = yMin + 3; y < yMax; y += 3) {
            ctx.moveTo(gLeft + 1, y);
            ctx.lineTo(gRight - 1, y);
        }
        for (let x = gLeft + 9; x < gRight; x += 9) {
            ctx.moveTo(x, yMin + 1);
            ctx.lineTo(x, yMax - 1);
        }
        ctx.stroke();

        ctx.restore();
    }

    private decorateFootballPitchIfNeeded() {
        if (!this.isFootballPitchLevel()) {
            return;
        }

        this._offScreenCanvases.forEach(canvas => this.drawFootballPitchOverlay(canvas));
    }
}

export class MazeBounds {
    static readonly topLeft = Point.zero;
    static readonly dimensions = new Vector2D(28, 30);
}
