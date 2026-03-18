import * as PIXI from "pixi.js"

export const SYMBOL_TEXTURES: Record<string, PIXI.Texture> = {}

export async function loadSymbols() {

    PIXI.Assets.add({ alias: "cherry", src: "/assets/cherry.png" })
    PIXI.Assets.add({ alias: "lemon", src: "/assets/lemon.png" })
    PIXI.Assets.add({ alias: "star", src: "/assets/star.png" })
    PIXI.Assets.add({ alias: "seven", src: "/assets/seven.png" })

    SYMBOL_TEXTURES["cherry"] = await PIXI.Assets.load("cherry")
    SYMBOL_TEXTURES["lemon"] = await PIXI.Assets.load("lemon")
    SYMBOL_TEXTURES["star"] = await PIXI.Assets.load("star")
    SYMBOL_TEXTURES["seven"] = await PIXI.Assets.load("seven")
}