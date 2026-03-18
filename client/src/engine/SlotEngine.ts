import {Reel} from "./Reel"

export class SlotEngine{

    reels:Reel[]

    constructor(reels:Reel[]){
        this.reels=reels
    }

    start(){

        this.reels.forEach(r=>r.start())
    }

    stop(stops:number[]){

        setTimeout(()=>this.reels[0].stop(stops[0]),800)
        setTimeout(()=>this.reels[1].stop(stops[1]),1200)
        setTimeout(()=>this.reels[2].stop(stops[2]),1600)
    }

    update(){

        this.reels.forEach(r=>r.update())
    }
}