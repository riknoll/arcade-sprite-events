//% block="Sprite Events"
//% color="#03a5fc" icon="\uf005"
//% groups="['Sprites','Tiles','Regions']"
namespace events {
    export const SPRITE_DATA_KEY = "@$_events_sprite_data";

    export enum SpriteEvent {
        //% block="start overlapping"
        StartOverlapping,
        //% block="stop overlapping"
        StopOverlapping
    }

    export enum TileEvent {
        //% block="starts overlapping"
        StartOverlapping,
        //% block="stops overlapping"
        StopOverlapping,
        //% block="fully within"
        Enters,
        //% block="no longer fully within"
        Exits,
        //% block="fully within area covered by"
        EntersArea,
        //% block="no longer fully within area covered by"
        ExitsArea
    }

    export enum RegionEvent {
        //% block="starts overlapping"
        StartOverlapping,
        //% block="stops overlapping"
        StopOverlapping,
        //% block="fully within"
        Enters,
        //% block="no longer fully within"
        Exits,
    }


    enum TileFlag {
        Overlapping = 1 << 0,
        FullyWithin = 1 << 1,
        WithinArea = 1 << 2
    }

    type SpriteHandler = (sprite: Sprite, otherSprite: Sprite) => void;
    type TileHandler = (sprite: Sprite) => void;

    let stateStack: EventState[];

    export class Region {
        constructor(public left: number, public top: number, public right: number, public bottom: number) { }

        equals(other: Region) {
            return other.left === this.left && other.top === this.top && other.right === this.right && other.bottom === this.bottom
        }

        checkSprite(sprite: Sprite) {
            if (sprite.left > this.right || sprite.top > this.bottom || sprite.right < this.left || sprite.bottom < this.top) {
                return 0;
            }

            if (sprite.left >= this.left && sprite.top >= this.top && sprite.right <= this.right && sprite.bottom <= this.bottom) {
                return TileFlag.Overlapping | TileFlag.FullyWithin;
            }

            return TileFlag.Overlapping;
        }
    }

    export class Coordinate {
        constructor(public x: number, public y: number) { }
    }

    class EventState {
        spriteHandlers: SpriteHandlerEntry[];
        tileHandlers: TileHandlerEntry[];
        regionHandlers: RegionHandlerEntry[];
        trackedSprites: Sprite[];

        constructor() {
            this.spriteHandlers = [];
            this.tileHandlers = [];
            this.regionHandlers = [];
            this.trackedSprites = [];

            game.eventContext().registerFrameHandler(scene.PHYSICS_PRIORITY + 1, () => {
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

            this.doRegionUpdate();

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

        getRegionHandler(event: RegionEvent, kind: number, region: Region) {
            for (const handler of this.regionHandlers) {
                if (handler.event === event && handler.kind === kind && handler.region.equals(region))
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
                }
            }

            for (const sprite of toRemove) {
                this.trackedSprites.removeElement(sprite);
            }
        }

        protected doRegionUpdate() {
            for (const regionHandler of this.regionHandlers) {
                for (const sprite of sprites.allOfKind(regionHandler.kind)) {
                    if (!sprite.data[SPRITE_DATA_KEY]) {
                        sprite.data[SPRITE_DATA_KEY] = new SpriteEventData(sprite);
                    }
                    const currentState: SpriteEventData = sprite.data[SPRITE_DATA_KEY];

                    const regionState = currentState.getRegionEntry(regionHandler.region, true);
                    const oldFlags = regionState.flag;

                    regionState.flag = regionHandler.region.checkSprite(sprite);

                    if (oldFlags === regionState.flag) continue;

                    if (regionState.flag & TileFlag.Overlapping) {
                        if (!(oldFlags & TileFlag.Overlapping)) {
                            this.runRegionHandler(RegionEvent.StartOverlapping, sprite, regionHandler.region)
                        }
                    }
                    else if (oldFlags & TileFlag.Overlapping) {
                        this.runRegionHandler(RegionEvent.StopOverlapping, sprite, regionHandler.region)
                    }

                    if (regionState.flag & TileFlag.FullyWithin) {
                        if (!(oldFlags & TileFlag.FullyWithin)) {
                            this.runRegionHandler(RegionEvent.Enters, sprite, regionHandler.region)
                        }
                    }
                    else if (oldFlags & TileFlag.FullyWithin) {
                        this.runRegionHandler(RegionEvent.Exits, sprite, regionHandler.region)
                    }
                }
            }
        }

        protected runRegionHandler(event: RegionEvent, sprite: Sprite, region: Region) {
            const handler = this.getRegionHandler(event, sprite.kind(), region);
            if (handler) handler.handler(sprite);
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

    class RegionHandlerEntry {
        constructor(
            public event: RegionEvent,
            public kind: number,
            public region: Region,
            public handler: TileHandler
        ) { }
    }

    class SpriteEventData {
        overlappingSprites: Sprite[];
        tiles: TileState[];
        regions: RegionState[];

        constructor(public owner: Sprite) {
            this.overlappingSprites = [];
            this.tiles = [];
            this.regions = [];
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

        getRegionEntry(region: Region, createIfMissing = false) {
            for (const regionState of this.regions) {
                if (regionState.region.equals(region)) return regionState;
            }

            if (createIfMissing) {
                const newEntry = new RegionState(region);
                this.regions.push(newEntry)
                return newEntry;
            }

            return undefined;
        }
    }

    class TileState {
        flag: number;
        constructor(public tile: number, flag = 0) {
            this.flag = flag;
        }
    }

    class RegionState {
        flag: number;
        constructor(public region: Region, flag = 0) {
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

    //% blockId=sprite_event_ext_sprite_event
    //% block="on $sprite of kind $kind $event with $otherSprite of kind $otherKind"
    //% draggableParameters="reporter"
    //% kind.shadow=spritekind
    //% otherKind.shadow=spritekind
    //% weight=90
    //% group="Sprites"
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

    //% blockId=sprite_event_ext_tile_event
    //% block="on $sprite of kind $kind $event tile $tile"
    //% draggableParameters="reporter"
    //% kind.shadow=spritekind
    //% tile.shadow=tileset_tile_picker
    //% weight=100
    //% group="Tilemaps"
    export function tileEvent(kind: number, tile: Image, event: TileEvent, handler: (sprite: Sprite) => void) {
        init();

        const existing = state().getTileHandler(event, kind, tile);
        if (existing) {
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

    //% blockId=sprite_event_ext_region_event
    //% block="on $sprite of kind $kind $event $region"
    //% draggableParameters="reporter"
    //% kind.shadow=spritekind
    //% region.shadow=sprite_event_ext_create_region_from_locations
    //% afterOnStart
    //% group="Regions"
    //% weight=100
    export function regionEvent(kind: number, region: Region, event: RegionEvent, handler: (sprite: Sprite) => void) {
        init();

        const existing = state().getRegionHandler(event, kind, region);
        if (existing) {
            existing.handler = handler;
            return;
        }

        state().regionHandlers.push(
            new RegionHandlerEntry(event, kind, region, handler)
        );
    }

    //% blockId=sprite_event_ext_create_coordinate
    //% block="x $x y $y"
    //% blockHidden
    //% group="Regions"
    export function createCoordinate(x: number, y: number) {
        return new Coordinate(x, y);
    }

    //% blockId=sprite_event_ext_create_region_from_coordinates
    //% block="region from|$location1 to|$location2"
    //% location1.shadow=sprite_event_ext_create_coordinate
    //% location2.shadow=sprite_event_ext_create_coordinate
    //% inlineInputMode=external
    //% group="Regions"
    //% weight=90
    //% blockGap=8
    export function createRegionFromCoordinates(location1: Coordinate, location2: Coordinate): Region {
        return new Region(
            Math.min(location1.x, location2.x),
            Math.min(location1.y, location2.y),
            Math.max(location1.x, location2.x),
            Math.max(location1.y, location2.y)
        );
    }


    //% blockId=sprite_event_ext_create_region_from_locations
    //% block="region from|$location1 to|$location2"
    //% location1.shadow=mapgettile
    //% location2.shadow=mapgettile
    //% inlineInputMode=external
    //% group="Regions"
    //% weight=80
    //% blockGap=8
    export function createRegionFromLocations(location1: tiles.Location, location2: tiles.Location): Region {
        return new Region(
            Math.min(location1.left, location2.left),
            Math.min(location1.top, location2.top),
            Math.max(location1.right, location2.right),
            Math.max(location1.bottom, location2.bottom)
        );
    }
}