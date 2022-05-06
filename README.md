# MakeCode Arcade sprite events extension

This extension adds a few blocks to MakeCode Arcade that give you events you can use with sprites and tilemaps.

Here's a quick sample of the events that are available:

## Tilemap events

This event block gives you a lot of events that are useful when using tilemaps. Here's an explanation of all of the different sub-events:

* **starts overlapping** - runs once when a sprite starts overlapping with any tile that has the given image
* **stops overlapping** - runs once when a sprite stops overlapping with any tile that has the given image
* **fully within** - runs once when a sprite is fully within a tile with the given image (i.e. it's only overlapping with one tile and that tile is the selected one)
* **no longer fully within** - runs once when a sprite that has been fully within a tile with the given image starts overlapping with another tile
* **fully within area covered by** - runs once when a sprite enters an area where it is only overlapping with tiles that have the given image. Very similar to the "fully within" event but it will run even if you're overlapping with multiple tiles as long as they are all the same kind
* **no longer fully within area covered by** - runs once when a sprite is no longer fully within an area covered by tiles that share the same image

## Sprite events

This event block gives you more options for the standard sprite overlaps block. They are:

* **starts overlapping** - runs once when a sprite starts overlapping with another sprite of the given kind
* **stops overlapping** - runs once when a sprite that has been overlapping with another sprite of the given kind is no longer overlapping with them

## **Region events**

Region events let you register events that run when a sprite enters or exits a certain part of the game world. In addition to using tilemap locations, you can also define regions using pixel coordinates. The different events are:

* **starts overlapping** - runs once when a sprite starts overlapping with a region
* **stops overlapping** - runs once when a sprite stops overlapping with a region
* **fully within** - runs once when a sprite fully enters a region
* **no longer fully within** - runs once when a sprite is no longer fully within a region


## Use as Extension

This repository can be added as an **extension** in MakeCode.

* open [https://arcade.makecode.com/](https://arcade.makecode.com/)
* click on **New Project**
* click on **Extensions** under the gearwheel menu
* search for **https://github.com/riknoll/arcade-sprite-events** and import


#### Metadata (used for search, rendering)

* for PXT/arcade
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
