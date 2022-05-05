namespace events {
    export const SPRITE_DATA_KEY = "@$_events_sprite_data";
    export const EVENT_ID = 323232;

    enum Event {
        SPRITE_START_OVERLAP = 1,
        SPRITE_STOP_OVERLAP,
        TILE_START_OVERLAP,
        TILE_STOP_OVERLAP,
        TILE_ENTER,
        TILE_EXIT,
        TILE_ENTER_AREA,
        TILE_EXIT_AREA
    }

    export enum SpriteEvent {
        //% block="start overlapping"
        StartOverlapping = Event.SPRITE_START_OVERLAP,
        //% block="stop overlapping"
        StopOverlapping = Event.SPRITE_STOP_OVERLAP
    }

    export enum TileEvent {
        //% block="start overlapping"
        StartOverlapping,
        //% block="stop overlapping"
        StopOverlapping,
        //% block="enters"
        Enters,
        //% block="exits"
        Exits,
        //% block="enters area"
        EntersArea,
        //% block="exits area"
        ExitsArea
    }

    type SpriteHandler = (sprite: Sprite, otherSprite: Sprite) => void;
    type TileHandler = (sprite: Sprite) => void;

    let stateStack: EventState[];

    class EventState {
        spriteHandlers: SpriteHandlerEntry[];
        tileHandlers: TileHandlerEntry[];
        trackedSprites: Sprite[];

        constructor() {
            this.spriteHandlers = [];
            this.tileHandlers = [];
            this.trackedSprites = [];

            game.eventContext().registerFrameHandler(scene.ANIMATION_UPDATE_PRIORITY, () => {
                this.update();
            });
        }

        update() {
            for (const sprite of this.trackedSprites) {
                const data = sprite.data[SPRITE_DATA_KEY] as SpriteEventData;

                for (const otherSprite of data.overlappingSprites) {
                    if (!sprite.overlapsWith(otherSprite)) {
                        data.overlappingSprites.removeElement(otherSprite);

                        const handler = this.getSpriteHandler(SpriteEvent.StopOverlapping, sprite.kind(), otherSprite.kind());
                        if (handler) handler.handler(sprite, otherSprite);
                    }
                }

                for (const handler of this.tileHandlers) {
                    if (handler.kind === sprite.kind()) {
                        updateTileStateAndFireEvents(
                            sprite,
                            game.currentScene().tileMap.getImageType(handler.tile),
                            game.currentScene().tileMap
                        )
                    }
                }
            }

            this.pruneTrackedSprites();
        }

        getSpriteHandler(event: SpriteEvent, kind: number, otherKind: number) {
            for (const handler of this.spriteHandlers) {
                if (handler.event === event && handler.kind === kind && handler.otherKind === otherKind)
                    return handler;
            }

            return undefined;
        }


        getTileHandler(event: TileEvent, kind: number, image: Image) {
            for (const handler of this.tileHandlers) {
                if (handler.event === event && handler.kind === kind && handler.tile.equals(image))
                    return handler;
            }

            return undefined;
        }

        protected pruneTrackedSprites() {
            const toRemove: Sprite[] = [];
            let data: SpriteEventData;

            for (const sprite of this.trackedSprites) {
                data = sprite.data[SPRITE_DATA_KEY];
                if (sprite.flags & sprites.Flag.Destroyed || (data.overlappingSprites.length == 0 && data.tiles.length === 0)) {
                    toRemove.push(sprite);
                    sprite.data[SPRITE_DATA_KEY] = undefined;
                }
            }

            for (const sprite of toRemove) {
                this.trackedSprites.removeElement(sprite);
            }
        }
    }

    class SpriteHandlerEntry {
        constructor(
            public event: SpriteEvent,
            public kind: number,
            public otherKind: number,
            public handler: SpriteHandler
        ) { }
    }

    class TileHandlerEntry {
        constructor(
            public event: TileEvent,
            public kind: number,
            public tile: Image,
            public handler: TileHandler
        ) { }
    }

    class SpriteEventData {
        overlappingSprites: Sprite[];
        tiles: TileState[];

        constructor(public owner: Sprite) {
            this.overlappingSprites = [];
            this.tiles = [];
        }

        getTileEntry(index: number, createIfMissing = false) {
            for (const tile of this.tiles) {
                if (tile.tile === index) {
                    return tile;
                }
            }

            if (createIfMissing) {
                const newEntry = new TileState(index);
                this.tiles.push(newEntry)
                return newEntry;
            }

            return undefined;
        }
    }

    enum TileFlag {
        Overlapping = 1 << 0,
        FullyWithin = 1 << 1,
        WithinArea = 1 << 2
    }

    class TileState {
        flag: number;
        constructor(public tile: number, flag = 0) {
            this.flag = flag;
        }
    }

    function init() {
        if (stateStack) return;
        stateStack = [new EventState()];

        game.addScenePushHandler(() => {
            stateStack.push(new EventState());
        });

        game.removeScenePushHandler(() => {
            stateStack.pop();
            if (!stateStack.length) stateStack.push(new EventState());
        });
    }

    function state() {
        init();
        return stateStack[stateStack.length - 1];
    }

    //% block="on $sprite of kind $kind $event with $otherSprite of kind $otherKind"
    //% draggableParameters="reporter"
    //% kind.shadow=spritekind
    //% otherKind.shadow=spritekind
    export function spriteEvent(kind: number, otherKind: number, event: SpriteEvent, handler: (sprite: Sprite, otherSprite: Sprite) => void) {
        init();

        const existing = state().getSpriteHandler(event, kind, otherKind);
        if (existing) {
            existing.handler = handler;
            return;
        }

        state().spriteHandlers.push(
            new SpriteHandlerEntry(event, kind, otherKind, handler)
        );

        sprites.onOverlap(kind, otherKind, (sprite, otherSprite) => {
            const currentState = state();

            if (!sprite.data[SPRITE_DATA_KEY]) {
                sprite.data[SPRITE_DATA_KEY] = new SpriteEventData(sprite);
                currentState.trackedSprites.push(sprite);
            }

            const data: SpriteEventData = sprite.data[SPRITE_DATA_KEY];
            const isOverlappingAlready = data.overlappingSprites.indexOf(otherSprite) !== -1;

            if (!isOverlappingAlready) {
                data.overlappingSprites.push(otherSprite);

                const handler = currentState.getSpriteHandler(SpriteEvent.StartOverlapping, kind, otherKind)
                if (handler) {
                    handler.handler(sprite, otherSprite);
                }
            }
        });
    }

    //% block="on $sprite of kind $kind $event $tile"
    //% draggableParameters="reporter"
    //% kind.shadow=spritekind
    //% tile.shadow=tileset_tile_picker
    export function tileEvent(kind: number, tile: Image, event: TileEvent, handler: (sprite: Sprite) => void) {
        init();

        const existing = state().getTileHandler(event, kind, tile);
        if (existing) {
            console.log("override")
            existing.handler = handler;
            return;
        }

        state().tileHandlers.push(
            new TileHandlerEntry(event, kind, tile, handler)
        );

        scene.onOverlapTile(kind, tile, (sprite, location) => {
            updateTileStateAndFireEvents(sprite, location.tileSet, location.tileMap);
        })
    }

    function updateTileStateAndFireEvents(sprite: Sprite, tileIndex: number, map: tiles.TileMap) {
        let data: SpriteEventData = sprite.data[SPRITE_DATA_KEY];

        if (!data) {
            data = new SpriteEventData(sprite);
            sprite.data[SPRITE_DATA_KEY] = data;
            state().trackedSprites.push(sprite);
        }

        const tileState = data.getTileEntry(tileIndex, true);

        const oldFlags = tileState.flag;
        updateTileState(tileState, sprite, tileIndex, map);

        if (oldFlags === tileState.flag) return;

        console.log(`${tileIndex} ${oldFlags} ${tileState.flag}`)

        if (tileState.flag & TileFlag.Overlapping) {
            if (!(oldFlags & TileFlag.Overlapping)) {
                runTileEventHandlers(sprite, TileEvent.StartOverlapping, tileIndex);
            }
        }
        else if (oldFlags & TileFlag.Overlapping) {
            runTileEventHandlers(sprite, TileEvent.StopOverlapping, tileIndex);
        }

        if (tileState.flag & TileFlag.FullyWithin) {
            if (!(oldFlags & TileFlag.FullyWithin)) {
                runTileEventHandlers(sprite, TileEvent.Enters, tileIndex);
            }
        }
        else if (oldFlags & TileFlag.FullyWithin) {
            runTileEventHandlers(sprite, TileEvent.Exits, tileIndex);
        }

        if (tileState.flag & TileFlag.WithinArea) {
            if (!(oldFlags & TileFlag.WithinArea)) {
                runTileEventHandlers(sprite, TileEvent.EntersArea, tileIndex);
            }
        }
        else if (oldFlags & TileFlag.WithinArea) {
            runTileEventHandlers(sprite, TileEvent.ExitsArea, tileIndex);
        }

        if (tileState.flag === 0) {
            data.tiles.removeElement(tileState);
        }
    }

    function updateTileState(tileState: TileState, sprite: Sprite, tileIndex: number, map: tiles.TileMap) {
        const tileWidth = 1 << map.scale;

        const x0 = Math.idiv(sprite.left, tileWidth);
        const y0 = Math.idiv(sprite.top, tileWidth);
        const x1 = Math.idiv(sprite.right, tileWidth);
        const y1 = Math.idiv(sprite.bottom, tileWidth);

        tileState.flag = 0;

        if (x0 === x1 && y0 === y1) {
            if (map.getTileIndex(x0, y0) === tileIndex) {
                tileState.flag = TileFlag.Overlapping | TileFlag.FullyWithin | TileFlag.WithinArea;
            }
            return tileState;
        }

        for (let x = x0; x <= x1; x++) {
            for (let y = y0; y <= y1; y++) {
                if (map.getTileIndex(x, y) === tileIndex) {
                    tileState.flag = TileFlag.Overlapping;
                }
                else if (tileState.flag & TileFlag.Overlapping) {
                    return tileState;
                }
            }
        }

        if (tileState.flag & TileFlag.Overlapping) {
            tileState.flag |= TileFlag.WithinArea;
        }


        return tileState;
    }

    function runTileEventHandlers(sprite: Sprite, event: TileEvent, tileIndex: number) {
        const handler = state().getTileHandler(
            event,
            sprite.kind(),
            game.currentScene().tileMap.getTileImage(tileIndex)
        );
        if (handler) handler.handler(sprite);
    }
}